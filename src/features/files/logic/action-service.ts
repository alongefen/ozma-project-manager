import 'server-only';
import type { ActionsOf, FilesApi, Operation, Platform, Result } from '@/types/contracts';
import { failure } from '@/lib/db/rpc';
import { createFilesApi } from './index';

export function createFilesActions(platform: Platform): ActionsOf<FilesApi> {
  const api = createFilesApi(platform);
  function authenticated<I, O>(operation: Operation<I, O>) {
    return async (input: I): Promise<Result<O>> => {
      try {
        const context = await platform.auth.getContext();
        return context.ok ? await operation(context.value, input) : context;
      } catch { return failure('UNAVAILABLE'); }
    };
  }
  return {
    listAccessCandidates: authenticated(api.listAccessCandidates),
    listDocuments: authenticated(api.listDocuments),
    getDocument: authenticated(api.getDocument),
    createDocument: authenticated(api.createDocument),
    setDocumentAccess: authenticated(api.setDocumentAccess),
    setDocumentArchived: authenticated(api.setDocumentArchived),
  } satisfies ActionsOf<FilesApi>;
}
