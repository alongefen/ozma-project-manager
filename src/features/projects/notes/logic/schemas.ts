import { z } from 'zod';
import { UuidSchema } from '@/types/contracts/schemas';

export const MAX_NOTE = 5000;
const body = z.string().trim().min(1).max(MAX_NOTE);

export const NoteInputSchemas = {
  listNotes: z.strictObject({ projectId: UuidSchema }),
  createNote: z.strictObject({ requestId: UuidSchema, projectId: UuidSchema, body }),
  updateNote: z.strictObject({ id: UuidSchema, expectedRevision: z.number().int().positive(), body }),
  cancelNote: z.strictObject({ id: UuidSchema, expectedRevision: z.number().int().positive() }),
};

export type NoteRow = { id: string; body: string; authorId: string; authorName: string; createdAt: string; editedAt: string | null; revision: number };
export type NotesList = { notes: NoteRow[]; canWrite: boolean; viewerId: string; isOwner: boolean };
