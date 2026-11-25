// Pure model of the "new project" wizard: steps, which fields belong to which step, per-step checks.
import { validateValues, type FieldErrors, type FieldKey, type FormValues } from './form-model';

export type StepKey = 'details' | 'contact' | 'notes' | 'access' | 'cover';

export const STEPS: { key: StepKey; label: string }[] = [
  { key: 'details', label: 'פרטי הפרויקט' },
  { key: 'contact', label: 'פרטי איש קשר' },
  { key: 'notes', label: 'הערות' },
  { key: 'access', label: 'הרשאות עובדים' },
  { key: 'cover', label: 'תמונת הפרויקט' },
];

/** The form steps (before the project exists). The project is created when the last of them is confirmed. */
export const LAST_FORM_STEP = 2;

const FIELDS: Record<StepKey, FieldKey[]> = {
  details: ['name', 'businessName', 'siteAddress', 'startDate', 'endDate'],
  contact: ['contactName', 'contactPhone', 'contactEmail', 'contactRole'],
  notes: ['accessNotes'],
  access: [],
  cover: [],
};

export const stepFields = (index: number): FieldKey[] => FIELDS[STEPS[index].key];

/** Index of the step that holds a field, or -1. */
export const stepOfField = (field: FieldKey): number => STEPS.findIndex(s => FIELDS[s.key].includes(field));

/** Errors for the fields of one step only (the other steps may still be empty). */
export function validateStep(values: FormValues, index: number): FieldErrors {
  const all = validateValues(values);
  const own = new Set(stepFields(index));
  return Object.fromEntries(Object.entries(all).filter(([k]) => own.has(k as FieldKey))) as FieldErrors;
}

/** Lowest step index that has an error, so the wizard can slide back to it. */
export function firstStepWithError(errors: FieldErrors): number {
  const hits = (Object.keys(errors) as FieldKey[]).filter(k => errors[k]).map(stepOfField).filter(i => i >= 0);
  return hits.length ? Math.min(...hits) : -1;
}

export type RoleChoice = 'none' | 'worker' | 'manager';

/** What a role change means for the server: add, change, or remove a membership. */
export function roleAction(from: RoleChoice, to: RoleChoice): 'add' | 'change' | 'remove' | 'noop' {
  if (from === to) return 'noop';
  if (to === 'none') return 'remove';
  return from === 'none' ? 'add' : 'change';
}
