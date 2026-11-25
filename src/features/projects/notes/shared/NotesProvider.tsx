'use client';
import { createContext, useContext, useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Result } from '@/types/contracts';
import { ConfirmDialog, FormActions, Notice, Sheet } from '@/components/ui';
import { errorText } from '../../shared/view-model';
import { cancelNote, createNote, updateNote } from '../logic/actions';
import type { NoteRow, NotesList } from '../logic/schemas';
import { MAX_NOTE, parseNote } from './model';

type Ctx = NotesList & { openCreate: () => void; openEdit: (n: NoteRow) => void; askCancel: (n: NoteRow) => void };
const NotesContext = createContext<Ctx | null>(null);
export const useNotes = () => { const c = useContext(NotesContext); if (!c) throw new Error('NotesProvider missing'); return c; };

async function guarded(run: () => Promise<Result<unknown>>): Promise<Result<unknown>> {
  try { return await run(); } catch { return { ok: false, error: { code: 'UNAVAILABLE', message: '' } } as Result<unknown>; }
}

/** The one state of both layouts: the list comes from the server and is refreshed after every write. */
export function NotesProvider({ projectId, initial, children }: { projectId: string; initial: NotesList; children: ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());
  const id = useId();
  const [form, setForm] = useState<{ note: NoteRow | null } | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<NoteRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  // A retry after a lost answer keeps the same request id, so it cannot create twice.
  const ambiguous = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseNote(text);
    if (!parsed.ok) { setFieldError(parsed.error); return; }
    setFieldError(null); setBusy(true); setError(null);
    const note = form?.note ?? null;
    const result = await guarded(() => note
      ? updateNote({ id: note.id, expectedRevision: note.revision, body: parsed.body })
      : createNote({ requestId, projectId, body: parsed.body }));
    setBusy(false);
    if (!result.ok) {
      ambiguous.current = result.error.code === 'UNAVAILABLE';
      if (result.error.code === 'CONFLICT') { setForm(null); setMessage(errorText('CONFLICT')); refresh(); return; }
      setError(errorText(result.error.code)); return;
    }
    ambiguous.current = false;
    if (!note) setRequestId(crypto.randomUUID());
    setForm(null); setMessage(null); refresh();
  }

  async function confirmCancel() {
    if (!removing) return;
    const note = removing;
    setBusy(true); setError(null);
    const result = await guarded(() => cancelNote({ id: note.id, expectedRevision: note.revision }));
    setBusy(false);
    if (!result.ok) {
      if (result.error.code === 'CONFLICT') { setRemoving(null); setMessage(errorText('CONFLICT')); refresh(); return; }
      setError(errorText(result.error.code)); return;
    }
    setRemoving(null); setMessage(null); refresh();
  }

  const value: Ctx = {
    ...initial,
    openCreate: () => { setText(''); setError(null); setFieldError(null); if (!ambiguous.current) setRequestId(crypto.randomUUID()); setForm({ note: null }); },
    openEdit: note => { setText(note.body); setError(null); setFieldError(null); setForm({ note }); },
    askCancel: note => { setError(null); setRemoving(note); },
  };
  return (
    <NotesContext.Provider value={value}>
      <div className="nt-root">
        {message && <Notice tone="error">{message}</Notice>}
        {children}
      </div>
      <Sheet open={form !== null} onClose={() => setForm(null)} dismissible={!busy} title={form?.note ? 'עריכת הערה' : 'הערה חדשה'}>
        {form && (
          <form className="nt-form" onSubmit={submit} noValidate>
            <div className="ui-field">
              <label className="ui-field__label" htmlFor={`${id}-body`}>תוכן ההערה</label>
              <textarea id={`${id}-body`} className="ui-field__input nt-textarea" rows={6} value={text} autoFocus
                aria-invalid={fieldError ? true : undefined} aria-describedby={`${id}-count`} onChange={e => setText(e.target.value)} />
              <span id={`${id}-count`} className="ui-field__hint nt-count" aria-live="polite">{text.length} / {MAX_NOTE}</span>
              {fieldError && <span className="ui-field__error">{fieldError}</span>}
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <FormActions placement="sheet" submitLabel={busy ? 'שומר…' : 'שמירה'} busy={busy} onCancel={() => setForm(null)} />
          </form>
        )}
      </Sheet>
      <ConfirmDialog open={removing !== null} title="ביטול הערה" confirmLabel="ביטול ההערה" busyLabel="מבטל…" busy={busy} error={removing ? error : null} danger onConfirm={confirmCancel} onCancel={() => setRemoving(null)}>
        <p>ההערה תוסר מהרשימה. שום דבר לא נמחק לצמיתות.</p>
      </ConfirmDialog>
    </NotesContext.Provider>
  );
}
