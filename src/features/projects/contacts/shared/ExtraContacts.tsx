'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Result } from '@/types/contracts';
import { Button, ConfirmDialog, DeleteIcon, EditIcon, FormActions, IconButton, Notice, Sheet, TextField } from '@/components/ui';
import { errorText } from '../../shared/view-model';
import { createContact, removeContact, updateContact } from '../logic/actions';
import type { ContactRow, ContactsList } from '../logic/schemas';
import { callHref, draftOf, parseDraft, type ContactDraft, type ContactErrors } from './model';

async function guarded(run: () => Promise<Result<unknown>>): Promise<Result<unknown>> {
  try { return await run(); } catch { return { ok: false, error: { code: 'UNAVAILABLE', message: '' } } as Result<unknown>; }
}

/** The project's other contacts: everyone reads, managers and owner-level accounts add, edit and remove. Used by both shells. */
export function ExtraContacts({ projectId, initial }: { projectId: string; initial: ContactsList }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());
  const { contacts, canWrite } = initial;
  const [form, setForm] = useState<{ contact: ContactRow | null } | null>(null);
  const [draft, setDraft] = useState<ContactDraft>(draftOf(null));
  const [errors, setErrors] = useState<ContactErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ContactRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const ambiguous = useRef(false);

  function open(contact: ContactRow | null) {
    setDraft(draftOf(contact)); setErrors({}); setError(null);
    if (!contact && !ambiguous.current) setRequestId(crypto.randomUUID());
    setForm({ contact });
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseDraft(draft);
    if (!parsed.ok) { setErrors(parsed.errors); return; }
    setErrors({}); setBusy(true); setError(null);
    const contact = form?.contact ?? null;
    const fields = { name: parsed.name, roleTitle: parsed.roleTitle, phone: parsed.phone };
    const result = await guarded(() => contact
      ? updateContact({ id: contact.id, expectedRevision: contact.revision, ...fields })
      : createContact({ requestId, projectId, ...fields }));
    setBusy(false);
    if (!result.ok) {
      ambiguous.current = result.error.code === 'UNAVAILABLE';
      if (result.error.code === 'CONFLICT') { setForm(null); setMessage(errorText('CONFLICT')); refresh(); return; }
      setError(errorText(result.error.code)); return;
    }
    ambiguous.current = false;
    if (!contact) setRequestId(crypto.randomUUID());
    setForm(null); setMessage(null); refresh();
  }
  async function confirmRemove() {
    if (!removing) return;
    const contact = removing;
    setBusy(true); setError(null);
    const result = await guarded(() => removeContact({ id: contact.id, expectedRevision: contact.revision }));
    setBusy(false);
    if (!result.ok) {
      if (result.error.code === 'CONFLICT') { setRemoving(null); setMessage(errorText('CONFLICT')); refresh(); return; }
      setError(errorText(result.error.code)); return;
    }
    setRemoving(null); setMessage(null); refresh();
  }

  if (!contacts.length && !canWrite) return null;
  return (
    <div className="ct">
      {message && <Notice tone="error">{message}</Notice>}
      {contacts.length > 0 && (
        <ul className="ct-list" aria-label="אנשי קשר נוספים">
          {contacts.map(c => {
            const tel = callHref(c.phone);
            return (
              <li key={c.id} className="ct-item">
                <div className="ct-item__main">
                  <span className="ct-item__name">{c.name}</span>
                  {c.roleTitle && <span className="ct-item__role">{c.roleTitle}</span>}
                  <span className="ct-item__phone">{tel ? <a className="ltr" href={tel}>{c.phone}</a> : <span className="ltr">{c.phone}</span>}</span>
                </div>
                {canWrite && (
                  <div className="ct-item__actions">
                    <IconButton tone="danger" label={`הסרת איש קשר: ${c.name}`} onClick={() => { setError(null); setRemoving(c); }}><DeleteIcon /></IconButton>
                    <IconButton label={`עריכת איש קשר: ${c.name}`} onClick={() => open(c)}><EditIcon /></IconButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canWrite && <Button variant="secondary" className="ui-lead" icon="add" onClick={() => open(null)}>הוספת איש קשר</Button>}
      <Sheet open={form !== null} onClose={() => setForm(null)} dismissible={!busy} title={form?.contact ? 'עריכת איש קשר' : 'איש קשר חדש'}>
        {form && (
          <form className="ct-form" onSubmit={submit} noValidate>
            <TextField label="שם *" value={draft.name} error={errors.name} autoComplete="off" autoFocus onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
            <TextField label="תפקיד" value={draft.roleTitle} error={errors.roleTitle} autoComplete="off" onChange={e => setDraft(d => ({ ...d, roleTitle: e.target.value }))} />
            <TextField label="טלפון *" value={draft.phone} error={errors.phone} ltr type="tel" inputMode="tel" autoComplete="off" onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} />
            {error && <Notice tone="error">{error}</Notice>}
            <FormActions placement="sheet" submitLabel={busy ? 'שומר…' : 'שמירה'} busy={busy} onCancel={() => setForm(null)} />
          </form>
        )}
      </Sheet>
      <ConfirmDialog open={removing !== null} title="הסרת איש קשר" confirmLabel="הסרה" busyLabel="מסיר…" busy={busy} error={removing ? error : null} danger onConfirm={confirmRemove} onCancel={() => setRemoving(null)}>
        <p>איש הקשר יוסר מהרשימה. שום דבר לא נמחק לצמיתות.</p>
      </ConfirmDialog>
    </div>
  );
}
