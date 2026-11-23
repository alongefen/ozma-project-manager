import 'server-only';
import type { FilesApi, Platform } from '@/types/contracts';

export function createCommands(platform: Platform) {
  return {
    createDocument: (ctx, input) => platform.rpc(ctx, 'create_document', input),
    setDocumentAccess: (ctx, input) => platform.rpc(ctx, 'set_document_access', input),
    setDocumentArchived: (ctx, input) => platform.rpc(ctx, 'set_document_archived', input),
  } satisfies Pick<FilesApi, 'createDocument' | 'setDocumentAccess' | 'setDocumentArchived'>;
}
