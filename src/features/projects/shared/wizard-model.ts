// Pure model of the "new project" wizard: steps, which fields belong to which step, per-step checks.
import { NO_CONTACT } from './view-model';
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
  contact: [], // the contact step has its own list of contacts (see ContactDraft), none of them required
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

/** One contact row of the wizard. Rows may stay empty; a row needs both a name and a phone, or neither. */
export type ContactDraft = { name: string; roleTitle: string; phone: string };
export type ContactDraftErrors = { name?: string; phone?: string };
export const MAX_WIZARD_CONTACTS = 5;
export const emptyContact = (): ContactDraft => ({ name: '', roleTitle: '', phone: '' });
const filled = (c: ContactDraft) => c.name.trim() !== '' || c.roleTitle.trim() !== '' || c.phone.trim() !== '';

/** Errors per row index; empty rows are ignored. */
export function validateContacts(rows: ContactDraft[]): Record<number, ContactDraftErrors> {
  const out: Record<number, ContactDraftErrors> = {};
  rows.forEach((c, i) => {
    if (!filled(c)) return;
    const e: ContactDraftErrors = {};
    if (!c.name.trim()) e.name = 'שדה חובה'; else if (c.name.trim().length > 120) e.name = 'יש לבדוק את הערך שהוזן';
    if (!c.phone.trim()) e.phone = 'שדה חובה'; else if (c.phone.trim().length > 40) e.phone = 'יש לבדוק את הערך שהוזן';
    if (c.roleTitle.trim().length > 120 && !e.name) e.name = 'התפקיד ארוך מדי';
    if (e.name || e.phone) out[i] = e;
  });
  return out;
}

/** The first contact becomes the primary one (the database needs one); the others are the extra contacts. */
export function splitContacts(rows: ContactDraft[]): { primary: { name: string; phone: string; roleTitle: string | null }; extras: { name: string; roleTitle: string | null; phone: string }[] } {
  const list = rows.filter(filled).map(c => ({ name: c.name.trim(), roleTitle: c.roleTitle.trim() || null, phone: c.phone.trim() }));
  const [first, ...extras] = list;
  return { primary: first ?? { ...NO_CONTACT, roleTitle: null }, extras };
}

export type RoleChoice = 'none' | 'worker' | 'manager';

/** What a role change means for the server: add, change, or remove a membership. */
export function roleAction(from: RoleChoice, to: RoleChoice): 'add' | 'change' | 'remove' | 'noop' {
  if (from === to) return 'noop';
  if (to === 'none') return 'remove';
  return from === 'none' ? 'add' : 'change';
}
