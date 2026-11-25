import 'server-only';
import type { Platform, Saved } from '@/types/contracts';
import { failure, mapError } from '@/lib/db/rpc';
import { untypedDb } from '../../logic/untyped-db';
import { validated } from '../../logic/validation';
import { NoteInputSchemas as s } from './schemas';
import type { NoteRow } from './schemas';
import type { NotesApi } from './api';

type Row = { id: string; body: string; author_id: string; author_name: string; created_at: string; edited_at: string | null; revision: number };

/** Notes of a project (CLIENT-FEEDBACK-B). Reads go through RLS; writes only through the database functions, which check role and state. */
export function createNotesApi(platform: Pick<Platform, 'rpc' | 'permissions'>): NotesApi {
  return {
    listNotes: validated(s.listNotes, async (ctx, { projectId }) => {
      const permission = await platform.permissions.forProject(ctx, { projectId });
      if (!permission.ok) return permission;
      if (!permission.value.view) return failure('NOT_FOUND');
      const { data, error } = await untypedDb(ctx).from('project_notes')
        .select('id,body,author_id,author_name,created_at,edited_at,revision')
        .eq('project_id', projectId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1000);
      if (error) return { ok: false, error: mapError(error) };
      const notes: NoteRow[] = ((data ?? []) as Row[]).map(r => ({ id: r.id, body: r.body, authorId: r.author_id, authorName: r.author_name, createdAt: r.created_at, editedAt: r.edited_at, revision: r.revision }));
      return { ok: true, value: { notes, canWrite: permission.value.writeTasks, viewerId: ctx.actor.userId, isOwner: ctx.actor.isOwner } };
    }),
    createNote: validated(s.createNote, (ctx, input) => platform.rpc<typeof input, Saved>(ctx, 'create_project_note', input)),
    updateNote: validated(s.updateNote, (ctx, input) => platform.rpc<typeof input, Saved>(ctx, 'update_project_note', input)),
    cancelNote: validated(s.cancelNote, (ctx, input) => platform.rpc<typeof input, Saved>(ctx, 'cancel_project_note', input)),
  };
}
