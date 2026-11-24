import type { AccessCandidate, DocumentAccess, DocumentCategory, DocumentRow } from '@/types/contracts';

export const CATEGORIES: { key: DocumentCategory; label: string }[] = [
  { key: 'specification', label: 'מפרט' },
  { key: 'plans', label: 'תוכניות' },
  { key: 'additional_plans', label: 'תוכניות נוספות' },
  { key: 'renderings', label: 'הדמיות' },
];

export const categoryLabel = (key: DocumentCategory): string => CATEGORIES.find(c => c.key === key)?.label ?? key;

export type AccessMode = DocumentAccess['mode'];
export const ACCESS_MODES: { mode: AccessMode; label: string; hint: string }[] = [
  { mode: 'owner', label: 'בן בלבד', hint: 'רק בעל החברה רואה את המסמך' },
  { mode: 'all', label: 'כל המשויכים לפרויקט', hint: 'כל מי ששויך לפרויקט רואה את המסמך' },
  { mode: 'selected', label: 'אנשים נבחרים', hint: 'רק מי שנבחר ברשימה רואה את המסמך' },
];

/** The access choice is mandatory: nothing is chosen by default, so no document is ever saved with an implied permission. */
export type AccessDraft = { mode: AccessMode | null; userIds: string[] };
export const emptyAccess: AccessDraft = { mode: null, userIds: [] };

export type AccessResult = { ok: true; access: DocumentAccess } | { ok: false; error: string };

/** Turns the draft into the value sent to the server; chosen people must still be on the candidates list. */
export function parseAccess(draft: AccessDraft, candidates: readonly AccessCandidate[]): AccessResult {
  if (!draft.mode) return { ok: false, error: 'יש לבחור מי רשאי לראות את המסמך' };
  if (draft.mode !== 'selected') return { ok: true, access: { mode: draft.mode } };
  const allowed = new Set(candidates.map(c => c.userId));
  const userIds = [...new Set(draft.userIds)].filter(id => allowed.has(id));
  if (userIds.length === 0) return { ok: false, error: 'יש לבחור לפחות אדם אחד' };
  return { ok: true, access: { mode: 'selected', userIds } };
}

export const toggleUser = (userIds: string[], id: string): string[] =>
  userIds.includes(id) ? userIds.filter(u => u !== id) : [...userIds, id];

export function accessDraftOf(access: DocumentAccess | undefined): AccessDraft {
  if (!access) return emptyAccess;
  return { mode: access.mode, userIds: access.mode === 'selected' ? [...access.userIds] : [] };
}

export function accessSummary(access: DocumentAccess | undefined, candidates: readonly AccessCandidate[]): string | null {
  if (!access) return null;
  if (access.mode === 'owner') return 'בן בלבד';
  if (access.mode === 'all') return 'כל המשויכים';
  const names = access.userIds.map(id => candidates.find(c => c.userId === id)?.fullName).filter(Boolean);
  const missing = access.userIds.length - names.length;
  return [...names, ...(missing > 0 ? [`${missing} לא משויכים עוד`] : [])].join(', ');
}

export type Lists = { active: DocumentRow[]; archived: DocumentRow[] };

export function countsOf(items: readonly DocumentRow[]): Record<DocumentCategory, number> {
  const counts: Record<DocumentCategory, number> = { specification: 0, plans: 0, additional_plans: 0, renderings: 0 };
  for (const item of items) counts[item.category] += 1;
  return counts;
}

/** The files of one category (or all when none is chosen), narrowed by a file-name search. */
export function visibleDocuments(items: readonly DocumentRow[], category: DocumentCategory | null, search: string): DocumentRow[] {
  const needle = search.trim().toLowerCase();
  return items.filter(d => (!category || d.category === category) && (!needle || d.file.name.toLowerCase().includes(needle)));
}

export const withoutDocument = (items: readonly DocumentRow[], id: string): DocumentRow[] => items.filter(d => d.id !== id);

export const fileHref = (fileId: string, download: boolean): string =>
  `/api/storage/files/${fileId}${download ? '?download=1' : ''}`;

/** Same rule as the diary: only a ready display image is shown; the route checks the viewer's access like "open". */
export const thumbUrl = (f: { id: string; mime: string; displayState: string }): string | null =>
  f.mime.startsWith('image/') && f.displayState === 'ready' ? `/api/storage/files/${f.id}?variant=display` : null;

/** Short upper-case type shown on the tile: the file's extension, else the type. */
export function extensionLabel(f: { name: string; mime: string }): string {
  const dot = f.name.lastIndexOf('.');
  const ext = dot > 0 ? f.name.slice(dot + 1).replace(/[^a-z0-9]/gi, '').slice(0, 4) : '';
  return (ext || (f.mime === 'application/pdf' ? 'pdf' : f.mime.split('/')[1] ?? 'file')).toUpperCase();
}

export function kindLabel(mime: string): string {
  if (mime === 'application/pdf') return 'PDF';
  return mime.startsWith('image/') ? 'תמונה' : 'קובץ';
}
