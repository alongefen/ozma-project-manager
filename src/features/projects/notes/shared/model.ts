import { MAX_NOTE } from '../logic/schemas';
import type { NoteRow } from '../logic/schemas';

export { MAX_NOTE };
export type NoteDraftResult = { ok: true; body: string } | { ok: false; error: string };

export function parseNote(text: string): NoteDraftResult {
  const body = text.trim();
  if (!body) return { ok: false, error: 'יש לכתוב הערה' };
  if (body.length > MAX_NOTE) return { ok: false, error: `ההערה ארוכה מדי (עד ${MAX_NOTE} תווים)` };
  return { ok: true, body };
}

/** Edit and cancel: the author, or an owner-level account. The database enforces the same rule. */
export function canChange(note: Pick<NoteRow, 'authorId'>, viewerId: string, isOwner: boolean, canWrite: boolean): boolean {
  return canWrite && (isOwner || note.authorId === viewerId);
}
