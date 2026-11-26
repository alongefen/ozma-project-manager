import 'server-only';
import { createHash } from 'node:crypto';
import type { Actor, Db, FileRef, StorageService, UploadCompletion } from '@/types/contracts';
import type { Json } from '@/types/database';
import { StorageServiceInputSchemas, UploadCompletionSchema, UuidSchema } from '@/types/contracts/schemas';
import { failure, mapError, rpc } from '@/lib/db/rpc';
import { OFFICE_BINARY, OFFICE_XML, detectMime, renderDisplay, validateContent } from './content';

const OFFICE_MIME = new Set([...OFFICE_BINARY, ...OFFICE_XML]);

type Description = { clientId: string; fileId: string; bucket: string; path: string };
type Authorized = { bucket: string; path: string; name: string; mime: string; sizeBytes: number };
type Options = { privileged: () => Db; url: string; publishableKey: string; renderDisplay?: typeof renderDisplay };
export function createStorageService(options: Options): StorageService {
  return {
    async beginUpload(ctx, input) {
      const parsed = StorageServiceInputSchemas.beginUpload.safeParse(input); if (!parsed.success) return failure('VALIDATION');
      const descriptions = await rpc<typeof input, Description[]>(ctx, 'begin_upload', parsed.data);
      if (!descriptions.ok) return descriptions;
      const targets = await Promise.all(descriptions.value.map(async item => {
        try {
          const { data, error } = await options.privileged().storage.from(item.bucket).createSignedUploadUrl(item.path, { upsert: false });
          return { clientId: item.clientId, target: error || !data ? failure('UNAVAILABLE') : { ok: true as const, value: { fileId: item.fileId, endpoint: `${options.url}/storage/v1/upload/resumable/sign`, publishableKey: options.publishableKey, token: data.token, bucket: item.bucket, path: item.path } } };
        } catch { return { clientId: item.clientId, target: failure('UNAVAILABLE') }; }
      }));
      return { ok: true, value: targets };
    },
    async finishUpload(ctx, input) {
      const parsed = StorageServiceInputSchemas.finishUpload.safeParse(input); if (!parsed.success) return failure('VALIDATION');
      const pending = await rpc<typeof input, UploadCompletion>(ctx, 'get_pending_upload', parsed.data);
      if (!pending.ok) return pending;
      const completion = UploadCompletionSchema.safeParse(pending.value);
      if (!completion.success) return failure('UNAVAILABLE');
      // The RPC checks current uploader/session/project access and refuses terminal replay after attachment.
      // Ready objects are returned as-is; no download, preview or privileged operation is repeated.
      if (completion.data.state === 'ready') return { ok: true, value: completion.data.fileRef };
      if (completion.data.state === 'rejected') return failure('VALIDATION');
      const actor = await rpc<Record<string, never>, Actor | null>(ctx, 'get_actor', {});
      if (!actor.ok) return actor;
      if (!actor.value || actor.value.userId !== pending.value.uploadedBy) return failure('UNAUTHENTICATED');
      try {
        const claims = await ctx.db.auth.getClaims();
        const sessionId = claims.data?.claims.session_id;
        if (claims.error || !UuidSchema.safeParse(sessionId).success || claims.data?.claims.sub !== actor.value.userId) return failure('UNAUTHENTICATED');
        const service = options.privileged();
        const file = pending.value;
        const downloaded = await service.storage.from(file.bucket).download(file.path);
        if (downloaded.error || !downloaded.data) return failure('UNAVAILABLE');
        const limit = file.purpose === 'document' ? 50 * 1024 * 1024 : 25 * 1024 * 1024;
        let mime: string | null = null;
        const size = downloaded.data.size;
        let bytes: Uint8Array | undefined;
        if (size > 0 && size <= limit && size === file.declaredSize) {
          bytes = new Uint8Array(await downloaded.data.arrayBuffer());
          mime = detectMime(bytes, file.declaredMime);
        }
        const valid = bytes && mime === file.declaredMime && !(file.purpose === 'cover' && mime === 'application/pdf') && !(file.purpose !== 'document' && OFFICE_MIME.has(mime)) && await validateContent(bytes, mime!);
        const identity = { fileId: file.fileId, actorId: actor.value.userId, sessionId: sessionId as string };
        if (!valid || !bytes || !mime) {
          console.error('[upload] content rejected', { fileId: file.fileId, declared: file.declaredMime, detected: mime, declaredSize: file.declaredSize, actualSize: size });
          const rejected = await service.rpc('system_finish_upload', { input: { ...identity, state: 'rejected' } });
          return rejected.error ? { ok: false, error: mapError(rejected.error) } : failure('VALIDATION');
        }
        const isImage = mime.startsWith('image/');
        let displayState: 'none' | 'failed' | 'ready' = isImage ? 'failed' : 'none';
        let displayPath: string | null = null;
        if (isImage) {
          try {
            const display = await (options.renderDisplay ?? renderDisplay)(bytes, mime);
            const path = `${file.projectId}/${file.fileId}.jpg`;
            const uploaded = await service.storage.from('display').upload(path, display, { contentType: 'image/jpeg', upsert: false });
            if (!uploaded.error) { displayState = 'ready'; displayPath = path; }
            else if (['409', 'Duplicate', 'ResourceAlreadyExists'].includes(String((uploaded.error as { statusCode?: string }).statusCode ?? uploaded.error.name))) {
              const prior = await service.storage.from('display').download(path);
              if (!prior.error && prior.data && createHash('sha256').update(new Uint8Array(await prior.data.arrayBuffer())).digest('hex') === createHash('sha256').update(display).digest('hex')) { displayState = 'ready'; displayPath = path; }
            }
          } catch (error) { console.error('[upload] display render failed', { fileId: file.fileId, mime, bytes: bytes.length, error: error instanceof Error ? error.name : 'unknown' }); /* Original remains intact and downloadable when preview conversion fails. */ }
        }
        const finished = await service.rpc('system_finish_upload', { input: { ...identity, state: 'ready', mime, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), displayState, displayPath } as Json });
        return finished.error ? { ok: false, error: mapError(finished.error) } : { ok: true, value: finished.data as FileRef };
      } catch (error) { console.error('[upload] finish failed', { error: error instanceof Error ? error.message : 'unknown' }); return failure('UNAVAILABLE'); }
    },
    async getSignedUrl(ctx, input) {
      const parsed = StorageServiceInputSchemas.getSignedUrl.safeParse(input); if (!parsed.success) return failure('VALIDATION');
      const authorized = await rpc<typeof input, Authorized>(ctx, 'authorize_file', parsed.data);
      if (!authorized.ok) return authorized;
      try {
        const file = authorized.value;
        const { data, error } = await options.privileged().storage.from(file.bucket).createSignedUrl(file.path, 60, { download: input.download ? file.name : false });
        return error || !data ? failure('UNAVAILABLE') : { ok: true, value: { url: data.signedUrl, expiresInSeconds: 60 } };
      } catch { return failure('UNAVAILABLE'); }
    },
    async readBytes(ctx, input) {
      const parsed = StorageServiceInputSchemas.readBytes.safeParse(input); if (!parsed.success) return failure('VALIDATION');
      const authorized = await rpc<typeof input, Authorized>(ctx, 'authorize_file', parsed.data);
      if (!authorized.ok) return authorized;
      try {
        const file = authorized.value;
        const { data, error } = await options.privileged().storage.from(file.bucket).download(file.path);
        return error || !data ? failure('UNAVAILABLE') : { ok: true, value: new Uint8Array(await data.arrayBuffer()) };
      } catch { return failure('UNAVAILABLE'); }
    },
  };
}
