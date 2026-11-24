import type { DiaryRow, IsoDate } from '@/types/contracts';
import { format } from '@/lib/format';

export const MAX_BODY = 20000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
export const isDate = (v: unknown): v is IsoDate =>
  typeof v === 'string' && DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

export type DiaryFilter = { projectId?: string; from?: IsoDate; to?: IsoDate };

/** Reads the filter from the URL. Anything malformed is ignored, so a bad link never breaks the list. */
export function parseFilter(query: Record<string, string | string[] | undefined>): DiaryFilter {
  const one = (k: string) => { const v = query[k]; return typeof v === 'string' ? v : undefined; };
  const out: DiaryFilter = {};
  const project = one('project'); if (isUuid(project)) out.projectId = project;
  const from = one('from'); if (isDate(from)) out.from = from;
  const to = one('to'); if (isDate(to)) out.to = to;
  if (out.from && out.to && out.from > out.to) { delete out.from; delete out.to; }
  return out;
}

export type DateGroup = { date: IsoDate; label: string; rows: DiaryRow[] };

/** The server returns rows newest first; consecutive rows of one work date share a heading. */
export function groupByDate(rows: DiaryRow[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last && last.date === row.workDate) last.rows.push(row);
    else groups.push({ date: row.workDate, label: format.date(row.workDate), rows: [row] });
  }
  return groups;
}

/** Appends a new page without repeating a row already shown. */
export function mergePage(current: DiaryRow[], next: DiaryRow[]): DiaryRow[] {
  const seen = new Set(current.map(r => r.id));
  return [...current, ...next.filter(r => !seen.has(r.id))];
}

export type Draft = { projectId: string; workDate: string; body: string };
export type DraftErrors = { projectId?: string; workDate?: string; body?: string };
export type DraftResult = { ok: true; projectId: string; workDate: IsoDate; body: string } | { ok: false; errors: DraftErrors };

export function parseDraft(draft: Draft): DraftResult {
  const errors: DraftErrors = {};
  if (!isUuid(draft.projectId)) errors.projectId = 'יש לבחור פרויקט';
  if (!isDate(draft.workDate)) errors.workDate = 'יש לבחור תאריך תקין';
  const body = draft.body.trim();
  if (!body) errors.body = 'יש לכתוב מה בוצע';
  else if (body.length > MAX_BODY) errors.body = `אפשר עד ${MAX_BODY} תווים`;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, projectId: draft.projectId, workDate: draft.workDate as IsoDate, body };
}

/** The PDF route (GET /api/reports/diary). `download` asks for a file instead of opening in the browser. */
export function reportUrl(scope: { kind: 'entry'; entryId: string } | { kind: 'day'; projectId: string; date: string }, opts: { part?: number; download?: boolean } = {}): string {
  const q = new URLSearchParams({ kind: scope.kind });
  if (scope.kind === 'entry') q.set('entryId', scope.entryId);
  else { q.set('projectId', scope.projectId); q.set('date', scope.date); }
  if (opts.part && opts.part > 1) q.set('part', String(opts.part));
  if (opts.download) q.set('download', '1');
  return `/api/reports/diary?${q}`;
}

export const fileUrl = (id: string, download = false) => `/api/storage/files/${id}${download ? '?download=1' : ''}`;
/** A small rendition for previews; only when the server made one. Otherwise the file is shown as a name. */
export const previewUrl = (f: { id: string; mime: string; displayState: string }) => (f.mime.startsWith('image/') && f.displayState === 'ready' ? `/api/storage/files/${f.id}?variant=display` : null);
export const isImage = (mime: string) => mime.startsWith('image/');

export function editedText(row: Pick<DiaryRow, 'editedAt' | 'editedByName'>): string | null {
  return row.editedAt ? `נערך ${format.dateTime(row.editedAt)}${row.editedByName ? ` · ${row.editedByName}` : ''}` : null;
}

/** Whether the viewer may add a report on a project: only from the live permission the server computed. */
export type ProjectOption = { id: string; name: string };

/** Newest work date first, then newest entry: the order the server list uses. */
export function sortRows(rows: DiaryRow[]): DiaryRow[] {
  return [...rows].sort((a, b) => (a.workDate === b.workDate ? (a.enteredAt === b.enteredAt ? (a.id < b.id ? 1 : -1) : a.enteredAt < b.enteredAt ? 1 : -1) : a.workDate < b.workDate ? 1 : -1));
}

/** Whether a saved report belongs in the list under the current filter. */
export function matchesFilter(row: DiaryRow, filter: DiaryFilter): boolean {
  return (!filter.projectId || row.projectId === filter.projectId) && (!filter.from || row.workDate >= filter.from) && (!filter.to || row.workDate <= filter.to);
}

/** The project a request came from, read from its referring address (`/projects/<id>/...`). Only the id is used, never the address. */
export function projectFromReferrer(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const m = /^\/projects\/([^/]+)(?:\/|$)/.exec(new URL(referrer).pathname);
    return m && isUuid(m[1]) ? m[1] : null;
  } catch { return null; }
}
