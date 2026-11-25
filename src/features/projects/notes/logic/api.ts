import type { Operation, Saved } from '@/types/contracts';
import type { NoteInputSchemas, NoteRow, NotesList } from './schemas';
import type { z } from 'zod';

type In<K extends keyof typeof NoteInputSchemas> = z.infer<(typeof NoteInputSchemas)[K]>;
export interface NotesApi {
  listNotes: Operation<In<'listNotes'>, NotesList>;
  createNote: Operation<In<'createNote'>, Saved>;
  updateNote: Operation<In<'updateNote'>, Saved>;
  cancelNote: Operation<In<'cancelNote'>, Saved>;
}
export type { NoteRow };
