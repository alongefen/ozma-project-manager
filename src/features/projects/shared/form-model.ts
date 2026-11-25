// Pure form model for the project form (F02), shared by the phone and desktop layouts.
// No React and no server code: trimming, empty-to-null and field errors only. Calculation-free.
import { ProjectFieldsSchema } from '@/types/contracts/schemas';
import type { ProjectDetails, ProjectFields } from '@/types/contracts';

export type FormValues = {
  name: string;
  businessName: string;
  siteAddress: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactRole: string;
  startDate: string;
  endDate: string;
  accessNotes: string;
};

export type FieldKey = keyof FormValues;
export type FieldErrors = Partial<Record<FieldKey, string>>;

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: 'שם הפרויקט', businessName: 'שם העסק', siteAddress: 'כתובת האתר', contactName: 'שם איש קשר', contactPhone: 'טלפון איש קשר',
  contactEmail: 'מייל איש קשר', contactRole: 'תפקיד איש קשר', startDate: 'תחילה בפועל', endDate: 'סיום בפועל', accessNotes: 'הערות',
};

export const REQUIRED_MESSAGE = 'שדה חובה';
export const INVALID_MESSAGE = 'יש לבדוק את הערך שהוזן';

export function emptyValues(): FormValues {
  return { name: '', businessName: '', siteAddress: '', contactName: '', contactPhone: '', contactEmail: '', contactRole: '', startDate: '', endDate: '', accessNotes: '' };
}

export function valuesFromDetails(d: ProjectDetails): FormValues {
  return {
    name: d.name, businessName: d.businessName, siteAddress: d.siteAddress,
    contactName: d.contact.name, contactPhone: d.contact.phone, contactEmail: d.contact.email ?? '', contactRole: d.contact.roleTitle ?? '',
    startDate: d.startDate ?? '', endDate: d.endDate ?? '', accessNotes: d.accessNotes ?? '',
  };
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * Builds the contract fields. The company number is not part of the form any more (A-45): it is never sent,
 * and the database keeps whatever value it already holds.
 */
export function toFields(v: FormValues): ProjectFields {
  return {
    name: v.name.trim(), businessName: v.businessName.trim(), siteAddress: v.siteAddress.trim(),
    contact: { name: v.contactName.trim(), phone: v.contactPhone.trim(), email: orNull(v.contactEmail), roleTitle: orNull(v.contactRole) },
    startDate: orNull(v.startDate), endDate: orNull(v.endDate), accessNotes: orNull(v.accessNotes),
  };
}

const PATH_TO_FIELD: Record<string, FieldKey> = {
  name: 'name', businessName: 'businessName', siteAddress: 'siteAddress',
  'contact.name': 'contactName', 'contact.phone': 'contactPhone', 'contact.email': 'contactEmail', 'contact.roleTitle': 'contactRole',
  startDate: 'startDate', endDate: 'endDate', accessNotes: 'accessNotes',
};

/** Maps contract/server field paths (for example "contact.phone") to form fields. Unknown paths are dropped. */
export function mapServerErrors(fieldErrors: Record<string, string> | undefined): FieldErrors {
  const out: FieldErrors = {};
  for (const [path, message] of Object.entries(fieldErrors ?? {})) {
    const key = PATH_TO_FIELD[path];
    if (key) out[key] = message;
  }
  return out;
}

/** Client pre-check against the same contract schema the server uses; the server stays authoritative. */
export function validateValues(v: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  const required: [FieldKey, string][] = [['name', v.name], ['businessName', v.businessName], ['siteAddress', v.siteAddress], ['contactName', v.contactName], ['contactPhone', v.contactPhone]];
  for (const [key, value] of required) if (value.trim() === '') errors[key] = REQUIRED_MESSAGE;
  const parsed = ProjectFieldsSchema.safeParse(toFields(v));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = PATH_TO_FIELD[issue.path.map(String).join('.')];
      if (key && !errors[key]) errors[key] = key === 'endDate' && v.startDate && v.endDate ? 'תאריך הסיום קודם להתחלה' : INVALID_MESSAGE;
    }
  }
  return errors;
}

/** The first field with an error in form order, so the screen can focus it. */
export const FIELD_ORDER: FieldKey[] = ['name', 'businessName', 'siteAddress', 'contactName', 'contactPhone', 'contactEmail', 'contactRole', 'startDate', 'endDate', 'accessNotes'];
export function firstErrorField(errors: FieldErrors): FieldKey | null {
  return FIELD_ORDER.find(key => errors[key]) ?? null;
}
