'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ConfirmDialog, DateField, Notice, SelectField, Sheet, TextField } from '@/components/ui';
import { listUsers, removeMembership, setFinanceAccess, setMembership } from '@/features/users/logic/actions';
import { createProject } from '../logic/actions';
import { CoverControl } from './CoverControl';
import { FIELD_LABELS, emptyValues, firstErrorField, mapServerErrors, toFields, validateValues, type FieldErrors, type FieldKey, type FormValues } from './form-model';
import { errorText } from './view-model';
import { LAST_FORM_STEP, STEPS, firstStepWithError, roleAction, stepFields, validateStep, type RoleChoice } from './wizard-model';
import css from './NewProjectWizard.module.css';

type Person = { id: string; fullName: string; role: RoleChoice; finance: boolean; revision: number | null };
const ROLES: { value: RoleChoice; label: string }[] = [{ value: 'worker', label: 'עובד' }, { value: 'manager', label: 'מנהל' }];

/**
 * "New project" as a window with five steps that slide sideways (Alon, 23.11): project details, contact,
 * notes, workers' permissions, cover image. Bottom sheet on the phone, centred pop-up on desktop. Nothing
 * scrolls inside a step. The project is created when the notes step is confirmed; permissions and cover
 * then apply to the saved project, and each can be skipped. Owner only (the page and the actions enforce it).
 */
export function NewProjectWizard({ defaultOpen = false, closeHref }: { defaultOpen?: boolean; /** Where to go when the window closes without creating anything (deep link use). */ closeHref?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<FormValues>(emptyValues());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; revision: number } | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [removing, setRemoving] = useState<Person | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const dirty = useRef(false);
  const formId = useId();

  const setField = (key: FieldKey, value: string) => { dirty.current = true; setValues(v => ({ ...v, [key]: value })); };
  const set = (key: FieldKey) => (e: { target: { value: string } }) => setField(key, e.target.value);
  const focusIn = (index: number, errs: FieldErrors) => setTimeout(() => {
    const key = stepFields(index).find(k => errs[k]) ?? firstErrorField(errs);
    if (key) document.querySelector<HTMLElement>(`[data-wizard-field="${key}"]`)?.focus();
  }, 320);

  // The people list is read when the permissions step is reached (owner-only action).
  useEffect(() => {
    if (step !== 3 || people || !created) return;
    let alive = true;
    listUsers({}).then(r => {
      if (!alive) return;
      if (!r.ok) { setPeopleError(errorText(r.error.code, r.error.message)); return; }
      setPeople(r.value.filter(u => u.isActive && !u.isOwner).map(u => ({ id: u.id, fullName: u.fullName, role: 'none' as RoleChoice, finance: false, revision: null })));
    });
    return () => { alive = false; };
  }, [step, people, created]);

  function finish() {
    if (created) { router.push(`/projects/${created.id}`); router.refresh(); }
    setOpen(false);
  }
  function requestClose() {
    if (busy) return;
    if (created) { finish(); return; }
    if (dirty.current) { setLeaving(true); return; }
    leave();
  }
  function leave() {
    setLeaving(false);
    setOpen(false);
    if (closeHref) router.push(closeHref);
  }

  async function next() {
    if (busy) return;
    setMessage(null);
    if (step < LAST_FORM_STEP) {
      const found = validateStep(values, true, step);
      setErrors(found);
      if (firstErrorField(found)) { setMessage('יש לתקן את השדות המסומנים'); focusIn(step, found); return; }
      setStep(step + 1);
      return;
    }
    if (step === LAST_FORM_STEP) {
      const found = validateValues(values, true);
      if (firstErrorField(found)) {
        setErrors(found);
        const target = firstStepWithError(found);
        setStep(Math.max(0, target)); setMessage('יש לתקן את השדות המסומנים'); focusIn(target, found); return;
      }
      setErrors({});
      setBusy(true);
      const result = await createProject({ requestId, fields: toFields(values, true) });
      setBusy(false);
      if (!result.ok) {
        const server = mapServerErrors(result.error.fieldErrors);
        setErrors(server);
        const target = firstStepWithError(server);
        if (target >= 0) { setStep(target); focusIn(target, server); }
        setMessage(result.error.code === 'VALIDATION' ? 'יש לתקן את השדות המסומנים' : errorText(result.error.code, result.error.message));
        return;
      }
      setCreated({ id: result.value.id, revision: result.value.revision });
      setStep(3);
      return;
    }
    if (step < STEPS.length - 1) { setStep(step + 1); return; }
    finish();
  }
  const back = () => { setMessage(null); if (step > 0 && !(created && step <= 3)) setStep(step - 1); };

  const patchPerson = (id: string, change: Partial<Person>) => setPeople(list => list && list.map(p => (p.id === id ? { ...p, ...change } : p)));
  async function chooseRole(person: Person, to: RoleChoice) {
    if (!created || busy) return;
    const action = roleAction(person.role, to);
    if (action === 'noop') return;
    setMessage(null);
    const before = person;
    patchPerson(person.id, { role: to, ...(to !== 'manager' ? { finance: false } : {}) });
    const result = action === 'remove'
      ? await removeMembership({ userId: person.id, projectId: created.id, expectedRevision: person.revision ?? 1 })
      : await setMembership({ userId: person.id, projectId: created.id, role: to as 'worker' | 'manager', expectedRevision: action === 'add' ? null : person.revision });
    if (!result.ok) { patchPerson(person.id, before); setMessage(errorText(result.error.code, result.error.message)); return; }
    patchPerson(person.id, { revision: action === 'remove' ? null : (result.value as { revision: number }).revision });
  }
  async function chooseFinance(person: Person, enabled: boolean) {
    if (!created || person.role !== 'manager' || person.revision === null) return;
    setMessage(null);
    const before = person;
    patchPerson(person.id, { finance: enabled });
    const result = await setFinanceAccess({ userId: person.id, projectId: created.id, enabled, expectedRevision: person.revision });
    if (!result.ok) { patchPerson(person.id, before); setMessage(errorText(result.error.code, result.error.message)); return; }
    patchPerson(person.id, { revision: result.value.revision });
  }

  const available = (people ?? []).filter(p => p.role === 'none');
  const added = (people ?? []).filter(p => p.role !== 'none');

  const field = (key: FieldKey, extra: { ltr?: boolean; type?: string; hint?: string } = {}) => (
    <TextField label={FIELD_LABELS[key]} value={values[key]} onChange={set(key)} error={errors[key]} ltr={extra.ltr} type={extra.type} hint={extra.hint}
      autoComplete="off" inputMode={extra.type === 'tel' ? 'tel' : undefined} data-wizard-field={key} />
  );

  const last = step === STEPS.length - 1;
  const primaryLabel = busy ? 'שומר…' : step === LAST_FORM_STEP ? 'יצירת פרויקט' : last ? 'סיום' : 'הבא';
  const canBack = step > 0 && !(created && step <= 3);

  return (
    <>
      <span className={css.trigger}><Button onClick={() => setOpen(true)}>פרויקט חדש</Button></span>
      <Sheet open={open} onClose={requestClose} title="פרויקט חדש" dismissible={!busy}>
        <div className={css.wizard}>
          <div className={css.progress} aria-label={`שלב ${step + 1} מתוך ${STEPS.length}`}>
            <p className={css.stepName}><span>{step + 1}/{STEPS.length}</span> {STEPS[step].label}</p>
            <div className={css.bars} aria-hidden="true">
              {STEPS.map((s, i) => <span key={s.key} className={`${css.bar}${i <= step ? ` ${css.barOn}` : ''}`} />)}
            </div>
          </div>
          <div className={css.viewport}>
            <div className={css.track} style={{ transform: `translateX(${step * 100}%)` }}>
              <form id={`${formId}-0`} className={css.step} inert={step !== 0} aria-hidden={step !== 0} onSubmit={e => { e.preventDefault(); next(); }} noValidate>
                <div className={css.twoWide}>
                  {field('name')}
                  {field('businessName')}
                </div>
                {field('siteAddress')}
                <div className={css.two}>
                  <DateField label={FIELD_LABELS.startDate} value={values.startDate} onChange={v => setField('startDate', v)} error={errors.startDate} data-wizard-field="startDate" />
                  <DateField label={FIELD_LABELS.endDate} value={values.endDate} onChange={v => setField('endDate', v)} error={errors.endDate} data-wizard-field="endDate" />
                </div>
                <div className={css.twoWide}>{field('businessNumber', { ltr: true })}</div>
                <button type="submit" className="sr-only" tabIndex={-1}>הבא</button>
              </form>
              <form id={`${formId}-1`} className={css.step} inert={step !== 1} aria-hidden={step !== 1} onSubmit={e => { e.preventDefault(); next(); }} noValidate>
                <div className={css.twoWide}>
                  {field('contactName')}
                  {field('contactRole')}
                </div>
                <div className={css.twoWide}>
                  {field('contactPhone', { ltr: true, type: 'tel' })}
                  {field('contactEmail', { ltr: true, type: 'email' })}
                </div>
                <button type="submit" className="sr-only" tabIndex={-1}>הבא</button>
              </form>
              <div className={css.step} inert={step !== 2} aria-hidden={step !== 2}>
                <label className={css.label} htmlFor={`${formId}-notes`}>{FIELD_LABELS.accessNotes}</label>
                <textarea id={`${formId}-notes`} className={css.textarea} value={values.accessNotes} onChange={set('accessNotes')} maxLength={2000} data-wizard-field="accessNotes" aria-invalid={errors.accessNotes ? true : undefined} />
                {errors.accessNotes && <span className="ui-field__error">{errors.accessNotes}</span>}
                <p className={css.hint}>בלחיצה על ״יצירת פרויקט״ הפרויקט נשמר. ההרשאות והתמונה בשלבים הבאים.</p>
              </div>
              <div className={css.step} inert={step !== 3} aria-hidden={step !== 3}>
                <p className={css.hint}>הפרויקט נוצר. הוסיפו עובדים לפרויקט, ואז בחרו לכל אחד תפקיד והרשאות. אפשר לשנות גם אחר כך בעמוד ההרשאות.</p>
                {peopleError && <Notice tone="error">{peopleError}</Notice>}
                {!people && !peopleError && <p className={css.hint}>טוען…</p>}
                {people && people.length === 0 && <p className={css.hint}>אין עוד משתמשים פעילים לשיוך.</p>}
                {people && people.length > 0 && (
                  <>
                    <SelectField label="הוספת עובד" placeholder={available.length ? 'בחירת עובד' : 'כל העובדים כבר נוספו'} value="" disabled={available.length === 0 || busy}
                      options={available.map(p => ({ value: p.id, label: p.fullName }))}
                      onChange={id => { const person = people.find(p => p.id === id); if (person) chooseRole(person, 'worker'); }} />
                    {added.length === 0
                      ? <p className={css.hint}>עוד לא נוספו עובדים. אפשר לדלג.</p>
                      : (
                        <ul className={css.people}>
                          {added.map(p => (
                            <li key={p.id} className={css.person}>
                              <strong className={css.pname}>{p.fullName}</strong>
                              <div className={css.seg} role="radiogroup" aria-label={`תפקיד של ${p.fullName}`}>
                                {ROLES.map(r => (
                                  <button key={r.value} type="button" role="radio" aria-checked={p.role === r.value} className={css.segBtn} onClick={() => chooseRole(p, r.value)}>{r.label}</button>
                                ))}
                              </div>
                              <label className={`${css.fin}${p.role !== 'manager' ? ` ${css.finOff}` : ''}`} title={p.role !== 'manager' ? 'גישה לכספים זמינה למנהל בלבד' : undefined}>
                                <input type="checkbox" checked={p.finance} disabled={p.role !== 'manager'} onChange={e => chooseFinance(p, e.target.checked)} />
                                <span>גישה לכספים</span>
                              </label>
                              <button type="button" className={css.removeBtn} onClick={() => setRemoving(p)} aria-label={`הסרת ${p.fullName} מהפרויקט`}>הסרה</button>
                            </li>
                          ))}
                        </ul>
                      )}
                  </>
                )}
              </div>
              <div className={css.step} inert={step !== 4} aria-hidden={step !== 4}>
                <p className={css.hint}>תמונה אחת לתיק הפרויקט. אפשר לדלג ולהוסיף אחר כך בעריכת הפרטים.</p>
                {created && <CoverControl id={created.id} revision={created.revision} coverFileId={null} onSaved={r => setCreated(c => c && { ...c, revision: r })} />}
              </div>
            </div>
          </div>
          <p className={css.status} role="status" aria-live="polite">{message && <span className={css.statusText}>{message}</span>}</p>
          <div className="ui-actions ui-actions--sheet">
            <Button disabled={busy} onClick={next}>{primaryLabel}</Button>
            {canBack && <span className={css.backSlot}><Button variant="secondary" disabled={busy} onClick={back}>הקודם</Button></span>}
          </div>
        </div>
      </Sheet>
      <ConfirmDialog open={removing !== null} title="להסיר מהפרויקט?" confirmLabel="הסרה" danger onConfirm={() => { const p = removing; setRemoving(null); if (p) chooseRole(p, 'none'); }} onCancel={() => setRemoving(null)}>
        <p>{removing?.fullName} יאבד את הגישה לפרויקט. שום דבר לא נמחק, ואפשר להוסיף אותו שוב.</p>
      </ConfirmDialog>
      <ConfirmDialog open={leaving} title="לצאת בלי לשמור?" confirmLabel="יציאה בלי לשמור" danger onConfirm={leave} onCancel={() => setLeaving(false)}>
        <p>הפרטים שהוזנו עדיין לא נשמרו, והם יימחקו מהחלון. הפרויקט לא ייווצר.</p>
      </ConfirmDialog>
    </>
  );
}
