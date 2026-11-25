'use server';
import type { RequestContext, Result } from '@/types/contracts';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { createNotesApi } from './index';
import type { NotesApi } from './api';

async function run<T>(op: (api: NotesApi, ctx: RequestContext) => Promise<Result<T>>): Promise<Result<T>> {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return context;
    return await op(createNotesApi(platform), context.value);
  } catch { return failure('UNAVAILABLE'); }
}
export async function createNote(input: Parameters<NotesApi['createNote']>[1]) { return run((a, c) => a.createNote(c, input)); }
export async function updateNote(input: Parameters<NotesApi['updateNote']>[1]) { return run((a, c) => a.updateNote(c, input)); }
export async function cancelNote(input: Parameters<NotesApi['cancelNote']>[1]) { return run((a, c) => a.cancelNote(c, input)); }
