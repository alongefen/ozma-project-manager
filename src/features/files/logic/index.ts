import 'server-only';
import type { FilesApi, Operation, Platform } from '@/types/contracts';
import { FilesApiInputSchemas } from '@/types/contracts/schemas';
import { failure } from '@/lib/db/rpc';
import type { z } from 'zod';
import { createQueries } from './queries';
import { createCommands } from './commands';

export function createFilesApi(platform: Platform): FilesApi {
  function validated<I, O>(schema: z.ZodType<I>, operation: Operation<I, O>): Operation<I, O> {
    return async (ctx, input) => {
      const parsed = schema.safeParse(input);
      if (!parsed.success) return failure('VALIDATION');
      try { return await operation(ctx, parsed.data); } catch { return failure('UNAVAILABLE'); }
    };
  }
  const api = { ...createQueries(platform), ...createCommands(platform) };
  return {
    listAccessCandidates: validated(FilesApiInputSchemas.listAccessCandidates, api.listAccessCandidates),
    listDocuments: validated(FilesApiInputSchemas.listDocuments, api.listDocuments),
    getDocument: validated(FilesApiInputSchemas.getDocument, api.getDocument),
    createDocument: validated(FilesApiInputSchemas.createDocument, api.createDocument),
    setDocumentAccess: validated(FilesApiInputSchemas.setDocumentAccess, api.setDocumentAccess),
    setDocumentArchived: validated(FilesApiInputSchemas.setDocumentArchived, api.setDocumentArchived),
  } satisfies FilesApi;
}
