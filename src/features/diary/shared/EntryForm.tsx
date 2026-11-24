'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { DiaryRow, FileRef, Result } from '@/types/contracts';
import { Button, FormActions, Notice } from '@/components/ui';
import { FileUpload } from '@/components/upload/FileUpload';
import { correctEntry, createEntry, listVersions, moveEntry } from '../logic/actions';
import { format } from '@/lib/format';
import { MAX_BODY, parseDraft, previewUrl, type DraftErrors, type ProjectOption } from './model';

type Props = {
  /** Present when editing. Only the owner may change project and date (A-16); everyone else sees them fixed. */
  entry?: DiaryRow;
  projects: ProjectOption[];
  canMove: boolean;
  today: string;
  initialProjectId?: string;
  onDone: (id: string) => void;
  onCancel: () => void;
};

const UNAVAILABLE = 'הפעולה לא הושלמה. יש לנסות שוב';
async function guarded<T>(run: () => Promise<Result<T>>): Promise<Result<T>> {
  try { return await run(); } catch { return { ok: false, error: { code: 'UNAVAILABLE', message: UNAVAILABLE } } as Result<T>; }
}

/** One short form, full screen on phone and a centred column on desktop: project, date, text, photos or PDFs. */
export function EntryForm({ entry, projects, canMove, today, initialProjectId, onDone, onCancel }: Props) {
  const id = useId();
  const [projectId, setProjectId] = useState(entry?.projectId ?? initialProjectId ?? (projects.length === 1 ? projects[0].id : ''));
  const [workDate, setWorkDate] = useState<string>(entry?.workDate ?? today);
  const [body, setBody] = useState(entry?.body ?? '');
  const [files, setFiles] = useState<FileRef[]>(entry?.files ?? []);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [initialRequestId] = useState(() => crypto.randomUUID());
  const requestId = useRef(initialRequestId);
  // The last create payload sent: a changed draft after a failure is a new request, never the old id with new data.
  const lastKey = useRef('');
  // What the server holds after each successful step, so a retry after a partial save never sends stale data.
  const saved = useRef(entry ? { revision: entry.revision, body: entry.body, fileIds: entry.files.map(f => f.id).join(), projectId: entry.projectId, workDate: entry.workDate as string } : null);
  const [uploaded, setUploaded] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    if (!entry) return;
    const kind = { created: 'נוצר', corrected: 'תוקן', moved: 'הועבר', cancelled: 'בוטל' } as const;
    let live = true;
    listVersions({ id: entry.id }).then(r => { if (live && r.ok) setHistory(r.value.map(v => `גרסה ${v.version} · ${kind[v.kind]} · ${v.editorName} · ${format.dateTime(v.createdAt)}`)); }).catch(() => {});
    return () => { live = false; };
  }, [entry]);
  const lockedProject = entry ? !canMove : false;
  const projectName = entry?.projectName ?? projects.find(p => p.id === projectId)?.name ?? '';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (uploading) return;
    const parsed = parseDraft({ projectId, workDate, body });
    if (!parsed.ok) { setErrors(parsed.errors); return; }
    setErrors({}); setError(null); setBusy(true);
    const fileIds = files.map(f => f.id);
    let failure: string | null = null;
    let savedId = entry?.id ?? '';
    if (!entry) {
      const key = JSON.stringify([parsed.projectId, parsed.workDate, parsed.body, fileIds]);
      if (lastKey.current && lastKey.current !== key) requestId.current = crypto.randomUUID();
      lastKey.current = key;
      const r = await guarded(() => createEntry({ requestId: requestId.current, projectId: parsed.projectId, workDate: parsed.workDate, body: parsed.body, fileIds }));
      if (!r.ok) {
        if (r.error.code !== 'UNAVAILABLE') requestId.current = crypto.randomUUID();
        failure = r.error.message;
      } else savedId = r.value.id;
    } else {
      const have = saved.current!;
      const changed = parsed.body !== have.body || fileIds.join() !== have.fileIds;
      if (changed) {
        const r = await guarded(() => correctEntry({ id: entry.id, expectedRevision: have.revision, body: parsed.body, fileIds }));
        if (r.ok) saved.current = { ...have, revision: r.value.revision, body: parsed.body, fileIds: fileIds.join() }; else failure = r.error.message;
      }
      const now = saved.current!;
      if (!failure && canMove && (parsed.projectId !== now.projectId || parsed.workDate !== now.workDate)) {
        const r = await guarded(() => moveEntry({ id: entry.id, expectedRevision: now.revision, projectId: parsed.projectId, workDate: parsed.workDate }));
        if (r.ok) saved.current = { ...now, revision: r.value.revision, projectId: parsed.projectId, workDate: parsed.workDate }; else failure = r.error.message;
      }
    }
    setBusy(false);
    if (failure) { setError(failure); return; }
    onDone(savedId);
  }

  return (
    <form className="dr-form" onSubmit={submit} noValidate>
      <div className="ui-field">
        <label className="ui-field__label" htmlFor={`${id}-project`}>פרויקט</label>
        {lockedProject ? <p className="dr-fixed">{projectName}</p> : (
          <select id={`${id}-project`} className="ui-field__input" value={projectId} disabled={uploaded || uploading} aria-invalid={errors.projectId ? true : undefined} onChange={e => setProjectId(e.target.value)}>
            <option value="">בחירת פרויקט</option>
            {entry && !projects.some(p => p.id === entry.projectId) && <option value={entry.projectId}>{entry.projectName}</option>}
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {uploaded && <span className="ui-field__hint">אחרי העלאת קובץ אי אפשר להחליף פרויקט</span>}
        {errors.projectId && <span className="ui-field__error">{errors.projectId}</span>}
      </div>
      <div className="ui-field">
        <label className="ui-field__label" htmlFor={`${id}-date`}>תאריך העבודה</label>
        {lockedProject ? <p className="dr-fixed">{workDate.split('-').reverse().join('.')}</p> : (
          <input id={`${id}-date`} type="date" className="ui-field__input dr-date" value={workDate} aria-invalid={errors.workDate ? true : undefined} onChange={e => setWorkDate(e.target.value)} />
        )}
        {errors.workDate && <span className="ui-field__error">{errors.workDate}</span>}
        {lockedProject && <span className="ui-field__hint">רק בן יכול לשנות פרויקט או תאריך</span>}
      </div>
      <div className="ui-field">
        <label className="ui-field__label" htmlFor={`${id}-body`}>מה בוצע</label>
        <textarea id={`${id}-body`} className="ui-field__input dr-textarea" rows={7} value={body} aria-invalid={errors.body ? true : undefined} aria-describedby={`${id}-count`} onChange={e => setBody(e.target.value)} />
        <span id={`${id}-count`} className="ui-field__hint dr-count" aria-live="polite">{body.length} / {MAX_BODY}</span>
        {errors.body && <span className="ui-field__error">{errors.body}</span>}
      </div>
      <div className="ui-field">
        <span className="ui-field__label">תמונות או PDF</span>
        {files.length > 0 && (
          <ul className="dr-file-edit">
            {files.map(f => (
              <li key={f.id} className="dr-file-row">
                {previewUrl(f)
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={previewUrl(f)!} alt={f.name} className="dr-thumb dr-thumb--small" />
                  : <span className="dr-file ltr">{f.name}</span>}
                <Button variant="secondary" size="small" aria-label={`הסרת ${f.name} מהדיווח`} onClick={() => setFiles(list => list.filter(x => x.id !== f.id))}>הסרה</Button>
              </li>
            ))}
          </ul>
        )}
        {isUuidLike(projectId)
          ? <FileUpload purpose="diary" projectId={projectId} camera label="בחירת תמונה או PDF" disabled={busy} onBusyChange={setUploading} onUploaded={added => { setUploaded(true); setFiles(list => [...list, ...added.filter(a => !list.some(x => x.id === a.id))]); }} />
          : <p className="ui-field__hint">יש לבחור פרויקט לפני צירוף קבצים</p>}
        <span className="ui-field__hint">עד 25MB לקובץ. הקובץ נשמר כפי שנשלח.</span>
      </div>
      {history.length > 0 && <details className="dr-fold"><summary>היסטוריית גרסאות</summary><ul className="dr-versions">{history.map(t => <li key={t}>{t}</li>)}</ul></details>}
      {error && <Notice tone="error">{error}</Notice>}
      <FormActions submitLabel={busy ? 'שומר…' : uploading ? 'מעלה קבצים…' : entry ? 'שמירת השינויים' : 'שמירת הדיווח'} busy={busy || uploading} placement="sheet" onCancel={() => { if (!uploading) onCancel(); }} />
    </form>
  );
}
const isUuidLike = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
