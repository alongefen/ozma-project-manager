'use server';
import type { ActionsOf, FilesApi } from '@/types/contracts';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { createFilesActions } from './action-service';
export async function listAccessCandidates(input: Parameters<ActionsOf<FilesApi>['listAccessCandidates']>[0]): ReturnType<ActionsOf<FilesApi>['listAccessCandidates']> {
  try { return await createFilesActions(await createPlatform()).listAccessCandidates(input); } catch { return failure('UNAVAILABLE'); }
}
export async function listDocuments(input: Parameters<ActionsOf<FilesApi>['listDocuments']>[0]): ReturnType<ActionsOf<FilesApi>['listDocuments']> {
  try { return await createFilesActions(await createPlatform()).listDocuments(input); } catch { return failure('UNAVAILABLE'); }
}
export async function getDocument(input: Parameters<ActionsOf<FilesApi>['getDocument']>[0]): ReturnType<ActionsOf<FilesApi>['getDocument']> {
  try { return await createFilesActions(await createPlatform()).getDocument(input); } catch { return failure('UNAVAILABLE'); }
}
export async function createDocument(input: Parameters<ActionsOf<FilesApi>['createDocument']>[0]): ReturnType<ActionsOf<FilesApi>['createDocument']> {
  try { return await createFilesActions(await createPlatform()).createDocument(input); } catch { return failure('UNAVAILABLE'); }
}
export async function setDocumentAccess(input: Parameters<ActionsOf<FilesApi>['setDocumentAccess']>[0]): ReturnType<ActionsOf<FilesApi>['setDocumentAccess']> {
  try { return await createFilesActions(await createPlatform()).setDocumentAccess(input); } catch { return failure('UNAVAILABLE'); }
}
export async function setDocumentArchived(input: Parameters<ActionsOf<FilesApi>['setDocumentArchived']>[0]): ReturnType<ActionsOf<FilesApi>['setDocumentArchived']> {
  try { return await createFilesActions(await createPlatform()).setDocumentArchived(input); } catch { return failure('UNAVAILABLE'); }
}
