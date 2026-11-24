'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Button, Notice, Sheet, TextField } from '@/components/ui';
import { changeName, changePassword } from '@/features/account/logic/actions';
import type { Actor } from '@/types/contracts';
import { accountErrorText, canEditOwnName, validateName, validatePasswordChange, type PasswordErrors } from './view-model';
import css from './AccountCard.module.css';

/** "My account" on the More screen (phone and desktop): who I am, change my name, change my password. Every role. */
export function AccountCard({ actor }: { actor: Pick<Actor, 'fullName' | 'email' | 'isOwner'> }) {
  const [sheet, setSheet] = useState<'name' | 'password' | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const close = () => setSheet(null);
  return (
    <div className={css.card}>
      <div className="more__account">
        <Avatar name={actor.fullName} />
        <div>
          <strong>{actor.fullName}</strong>
          <span className="more__sub ltr">{actor.email}</span>
        </div>
      </div>
      <div className={css.row}>
        {canEditOwnName(actor.isOwner) && <Button variant="secondary" onClick={() => { setDone(null); setSheet('name'); }}>עריכת שם</Button>}
        <Button variant="secondary" onClick={() => { setDone(null); setSheet('password'); }}>החלפת סיסמה</Button>
      </div>
      {done && <div role="status"><Notice>{done}</Notice></div>}
      <Sheet open={sheet === 'name'} onClose={close} title="עריכת שם">{sheet === 'name' && <NameForm initial={actor.fullName} onClose={close} onDone={() => { close(); setDone('השם עודכן'); }} />}</Sheet>
      <Sheet open={sheet === 'password'} onClose={close} title="החלפת סיסמה">{sheet === 'password' && <PasswordForm onClose={close} onDone={text => { close(); setDone(text); }} />}</Sheet>
    </div>
  );
}

function NameForm({ initial, onClose, onDone }: { initial: string; onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const problem = validateName(name);
    setError(problem);
    if (problem) return;
    setBusy(true); setFormError(null);
    const result = await changeName({ fullName: name.trim() });
    setBusy(false);
    if (!result.ok) { setFormError(result.error.fieldErrors?.fullName ?? accountErrorText(result.error.code)); if (result.error.code === 'CONFLICT') router.refresh(); return; }
    router.refresh(); // the header and every list read the profile's current name
    onDone();
  }
  return (
    <form className={css.form} onSubmit={submit} noValidate>
      <TextField label="שם מלא" value={name} onChange={e => setName(e.target.value)} error={error} autoComplete="name" hint="השם מוצג במערכת בכל מקום. דיווחים שכבר נשמרו נשארים עם השם שהיה בעת הדיווח." />
      {formError && <Notice tone="error">{formError}</Notice>}
      <div className="ui-actions ui-actions--sheet">
        <Button type="submit" disabled={busy}>{busy ? 'שומר…' : 'שמירה'}</Button>
        <Button variant="secondary" disabled={busy} onClick={onClose}>ביטול</Button>
      </div>
    </form>
  );
}

function PasswordForm({ onClose, onDone }: { onClose: () => void; onDone: (text: string) => void }) {
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const set = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues(v => ({ ...v, [field]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    const found = validatePasswordChange(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    inFlight.current = true; setBusy(true); setFormError(null);
    const result = await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
    inFlight.current = false; setBusy(false);
    if (!result.ok) {
      const fields = result.error.fieldErrors;
      if (fields?.currentPassword || fields?.newPassword) setErrors({ currentPassword: fields.currentPassword, newPassword: fields.newPassword });
      else setFormError(accountErrorText(result.error.code));
      return;
    }
    onDone(result.value.othersSignedOut ? 'הסיסמה הוחלפה. מכשירים אחרים שהיו מחוברים נותקו' : 'הסיסמה הוחלפה. אם אתם מחוברים במכשיר נוסף, כדאי להתנתק ממנו');
  }
  return (
    <form className={css.form} onSubmit={submit} noValidate>
      <TextField label="סיסמה נוכחית" type="password" value={values.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} autoComplete="current-password" />
      <TextField label="סיסמה חדשה" type="password" value={values.newPassword} onChange={set('newPassword')} error={errors.newPassword} autoComplete="new-password" hint="לפחות 8 תווים." />
      <TextField label="אימות סיסמה חדשה" type="password" value={values.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" />
      {formError && <Notice tone="error">{formError}</Notice>}
      <div className="ui-actions ui-actions--sheet">
        <Button type="submit" disabled={busy}>{busy ? 'שומר…' : 'החלפת סיסמה'}</Button>
        <Button variant="secondary" disabled={busy} onClick={onClose}>ביטול</Button>
      </div>
    </form>
  );
}
