import { describe, expect, it } from 'vitest';
import { ProjectFieldsSchema } from '@/types/contracts/schemas';
import { emptyValues, firstErrorField, mapServerErrors, toFields, validateValues, valuesFromDetails, type FormValues } from '@/features/projects/shared/form-model';
import type { ProjectDetails } from '@/types/contracts';

const ok = (): FormValues => ({ ...emptyValues(), name: 'בית הגפן', businessName: 'הגפן בע״מ', siteAddress: 'הרצל 1, חיפה', contactName: 'דנה', contactPhone: '050-0000000' });

describe('project form model', () => {
  it('turns empty optional fields into null and trims text', () => {
    const f = toFields({ ...ok(), name: '  בית  ', contactEmail: '  ', contactRole: '', accessNotes: '', startDate: '' });
    expect(f.name).toBe('בית');
    expect(f.contact).toEqual({ name: 'דנה', phone: '050-0000000', email: null, roleTitle: null });
    expect([f.startDate, f.endDate, f.accessNotes]).toEqual([null, null, null]);
    expect(ProjectFieldsSchema.safeParse(f).success).toBe(true);
  });
  it('never sends a company number (A-45), even if an old value sits in the state', () => {
    expect('businessNumber' in toFields({ ...ok(), businessNumber: '515000000' } as FormValues)).toBe(false);
  });
  it('requires name, business, address, contact name and phone; whitespace is not a value', () => {
    const errors = validateValues({ ...emptyValues(), name: '   ' });
    expect(Object.keys(errors).sort()).toEqual(['businessName', 'contactName', 'contactPhone', 'name', 'siteAddress']);
    expect(firstErrorField(errors)).toBe('name');
  });
  it('rejects a bad email and an end date before the start', () => {
    const errors = validateValues({ ...ok(), contactEmail: 'not-mail', startDate: '2026-05-10', endDate: '2026-05-01' });
    expect(errors.contactEmail).toBeTruthy();
    expect(errors.endDate).toBe('תאריך הסיום קודם להתחלה');
    expect(validateValues(ok())).toEqual({});
  });
  it('maps server field paths to form fields and drops unknown ones', () => {
    expect(mapServerErrors({ 'contact.phone': 'x', name: 'y', secret: 'z' })).toEqual({ contactPhone: 'x', name: 'y' });
    expect(mapServerErrors(undefined)).toEqual({});
  });
  it('fills the edit form from details, without a company number', () => {
    const d = { name: 'א', businessName: 'ב', siteAddress: 'ג', contact: { name: 'ד', phone: '1', email: null, roleTitle: null }, startDate: null, endDate: null, accessNotes: null } as unknown as ProjectDetails;
    const v = valuesFromDetails(d);
    expect('businessNumber' in v).toBe(false);
    expect(v.contactEmail).toBe('');
  });
});
