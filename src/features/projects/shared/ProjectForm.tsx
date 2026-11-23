'use client';
import { useEffect, useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, Notice, TextField } from '@/components/ui';
import { createProject, updateProject } from '../logic/actions';
import { emptyValues, firstErrorField, mapServerErrors, toFields, validateValues, type FieldErrors, type FieldKey, type FormValues } from './form-model';
import { errorText } from './view-model';
import css from './ProjectForm.module.css';

export type ProjectFormProps =
  | { mode: 'create'; isOwner: boolean; onDone?: undefined; onCancel?: undefined }
  | { mode: 'edit'; isOwner: boolean; projectId: string; revision: number; initial: FormValues; /** Inside a pop-up: close it after saving instead of navigating. */ onDone?: () => void; onCancel?: () => void };

const LABELS: Record<FieldKey, string> = {
  name: 'שם הפרויקט', businessName: 'שם העסק', siteAddress: 'כתובת האתר', contactName: 'שם איש קשר', contactPhone: 'טלפון איש קשר',
  contactEmail: 'מייל איש קשר', contactRole: 'תפקיד איש קשר', businessNumber: 'מספר חברה', startDate: 'תחילה בפועל', endDate: 'סיום בפועל', accessNotes: 'הערות',
};

function Section({ sheet, title, children }: { sheet: boolean; title: string; children: React.ReactNode }) {
  return sheet
    ? <section className={css.card}><h3 className={css.cardTitle}>{title}</h3>{children}</section>
    : <Card panel className={css.card}><h2 className={css.cardTitle}>{title}</h2>{children}</Card>;
}

/**
 * Project form F02, one component for both layouts: a single column with a save bar above the
 * bottom navigation on the phone, a two-column card with buttons on desktop (CSS, so a draft
 * survives a resize). All writes go through the server actions; the business number is owner-only.
 */
export function ProjectForm(props: ProjectFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(props.mode === 'edit' ? props.initial : emptyValues());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  // One id per opened form: a retry after an unknown answer repeats the same create, never a duplicate.
  const [requestId] = useState(() => crypto.randomUUID());
  const formId = useId();
  const { isOwner } = props;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (key: FieldKey) => (e: { target: { value: string } }) => { setValues(v => ({ ...v, [key]: e.target.value })); setDirty(true); };
  const focusFirst = (errs: FieldErrors) => { const k = firstErrorField(errs); if (k) document.querySelector<HTMLElement>(`[data-field="${k}"]`)?.focus(); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setMessage(null);
    const found = validateValues(values, isOwner);
    if (firstErrorField(found)) { setErrors(found); setMessage('יש לתקן את השדות המסומנים'); setTimeout(() => focusFirst(found), 0); return; }
    setErrors({});
    setSaving(true);
    const fields = toFields(values, isOwner);
    const result = props.mode === 'create'
      ? await createProject({ requestId, fields })
      : await updateProject({ id: props.projectId, expectedRevision: props.revision, fields });
    if (result.ok) {
      setDirty(false);
      if (props.onDone) { props.onDone(); router.refresh(); return; }
      router.push(`/projects/${result.value.id}`);
      router.refresh();
      return;
    }
    setSaving(false);
    const server = mapServerErrors(result.error.fieldErrors);
    setErrors(server);
    setMessage(result.error.code === 'VALIDATION' ? 'יש לתקן את השדות המסומנים' : errorText(result.error.code, result.error.message));
    if (firstErrorField(server)) setTimeout(() => focusFirst(server), 0);
  }

  const field = (key: FieldKey, extra: { ltr?: boolean; type?: string; required?: boolean; hint?: string; full?: boolean } = {}) => (
    <div className={extra.full ? css.full : undefined}>
      <TextField
        label={LABELS[key] + (extra.required ? ' *' : '')}
        value={values[key]}
        onChange={set(key)}
        error={errors[key]}
        ltr={extra.ltr}
        type={extra.type}
        hint={extra.hint}
        autoComplete="off"
        inputMode={extra.type === 'tel' ? 'tel' : undefined}
        data-field={key}
      />
    </div>
  );

  const cancelHref = props.mode === 'edit' ? `/projects/${props.projectId}` : '/projects';
  const sheet = props.mode === 'edit' && props.onCancel !== undefined;
  const saveLabel = saving ? 'שומר…' : props.mode === 'create' ? 'יצירת פרויקט' : 'שמירה';
  const errorList = (Object.keys(errors) as FieldKey[]).filter(k => errors[k]);
  return (
    <form id={formId} className={`${css.form}${sheet ? ` ${css.inSheet}` : ''}`} onSubmit={submit} noValidate>
      {message && <Notice tone="error">{message}</Notice>}
      {errorList.length > 0 && (
        <ul className={css.summary} aria-label="שדות לתיקון">
          {errorList.map(k => <li key={k}>{LABELS[k]}: {errors[k]}</li>)}
        </ul>
      )}
      <Section sheet={sheet} title="פרטי הפרויקט">
        <div className={css.grid}>
          {field('name', { required: true })}
          {field('businessName', { required: true })}
          {field('siteAddress', { required: true, full: true })}
          <div className={`${css.dates} ${css.full}`}>
            <TextField label={LABELS.startDate} type="date" ltr value={values.startDate} onChange={set('startDate')} error={errors.startDate} data-field="startDate" />
            <TextField label={LABELS.endDate} type="date" ltr value={values.endDate} onChange={set('endDate')} error={errors.endDate} data-field="endDate" />
          </div>
          {isOwner && field('businessNumber', { ltr: true, hint: 'מוצג לבן בלבד' })}
        </div>
      </Section>
      <Section sheet={sheet} title="איש קשר">
        <div className={css.grid}>
          {field('contactName', { required: true })}
          {field('contactPhone', { required: true, ltr: true, type: 'tel' })}
          {field('contactEmail', { ltr: true, type: 'email' })}
          {field('contactRole')}
        </div>
      </Section>
      <Section sheet={sheet} title="הערות">
        <div>
          <label className={css.label} htmlFor={`${formId}-notes`}>{LABELS.accessNotes}</label>
          <textarea id={`${formId}-notes`} className={css.textarea} value={values.accessNotes} onChange={set('accessNotes')} maxLength={2000} aria-invalid={errors.accessNotes ? true : undefined} />
          {errors.accessNotes && <span className="ui-field__error">{errors.accessNotes}</span>}
        </div>
      </Section>
      {sheet ? (
        <div className={css.sheetBar}>
          <Button type="submit" disabled={saving}>{saveLabel}</Button>
          <Button variant="secondary" onClick={() => props.onCancel?.()}>ביטול</Button>
        </div>
      ) : (<>
      <div className={css.deskBar}>
        <Button type="submit" disabled={saving}>{saveLabel}</Button>
        <Link href={cancelHref} className="ui-btn ui-btn--secondary" style={{ textDecoration: 'none' }}>ביטול</Link>
      </div>
      <div className={css.saveBar}>
        <Button type="submit" disabled={saving}>{saveLabel}</Button>
        <Link href={cancelHref} className="ui-btn ui-btn--secondary" style={{ textDecoration: 'none' }}>ביטול</Link>
      </div>
      </>)}
    </form>
  );
}
