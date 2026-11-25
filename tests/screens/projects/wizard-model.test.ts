import { describe, expect, it } from 'vitest';
import { emptyValues, type FormValues } from '@/features/projects/shared/form-model';
import { NO_CONTACT } from '@/features/projects/shared/view-model';
import { LAST_FORM_STEP, emptyContact, splitContacts, validateContacts, STEPS, firstStepWithError, roleAction, stepFields, stepOfField, validateStep } from '@/features/projects/shared/wizard-model';

const ok = (): FormValues => ({ ...emptyValues(), name: 'בית', businessName: 'עסק', siteAddress: 'רחוב 1', contactName: 'דנה', contactPhone: '0500000000' });

describe('new project wizard model', () => {
  it('has the five steps in the agreed order, the project is created after the notes step', () => {
    expect(STEPS.map(s => s.key)).toEqual(['details', 'contact', 'notes', 'access', 'cover']);
    expect(STEPS[LAST_FORM_STEP].key).toBe('notes');
  });
  it('maps every form field to exactly one step, and none to the access and cover steps', () => {
    expect(stepFields(0)).toContain('name');
    expect(stepFields(1)).toEqual([]);
    expect(stepFields(2)).toEqual(['accessNotes']);
    expect(stepFields(3)).toEqual([]);
    expect(stepOfField('endDate')).toBe(0);
    expect(stepOfField('contactEmail')).toBe(-1);
  });
  it('checks only the fields of the current step', () => {
    const empty = emptyValues();
    expect(Object.keys(validateStep(empty, 0)).sort()).toEqual(['businessName', 'name', 'siteAddress']);
    expect(validateStep(empty, 1)).toEqual({});
    expect(validateStep(empty, 2)).toEqual({});
    expect(validateStep(ok(), 0)).toEqual({});
  });
  it('rejects an end before the start on the first step', () => {
    expect(validateStep({ ...ok(), startDate: '2026-05-10', endDate: '2026-05-01' }, 0).endDate).toBeTruthy();
  });
  it('finds the earliest step with an error, or -1', () => {
    expect(firstStepWithError({ contactPhone: 'x', name: 'y' })).toBe(0);
    expect(firstStepWithError({ startDate: 'x' })).toBe(0);
    expect(firstStepWithError({})).toBe(-1);
  });
  it('maps a role change to the server operation', () => {
    expect(roleAction('none', 'worker')).toBe('add');
    expect(roleAction('worker', 'manager')).toBe('change');
    expect(roleAction('manager', 'none')).toBe('remove');
    expect(roleAction('worker', 'worker')).toBe('noop');
  });
  it('contacts are optional: empty rows are ignored, a half-filled row is an error, none stores the placeholder', () => {
    expect(validateContacts([emptyContact(), emptyContact()])).toEqual({});
    expect(validateContacts([{ name: 'דנה', roleTitle: '', phone: '' }, { name: '', roleTitle: '', phone: '050' }])).toEqual({ 0: { phone: 'שדה חובה' }, 1: { name: 'שדה חובה' } });
    expect(splitContacts([emptyContact()])).toEqual({ primary: { ...NO_CONTACT, roleTitle: null }, extras: [] });
  });
  it('the first filled contact is the primary one and the rest are extras, trimmed', () => {
    const r = splitContacts([emptyContact(), { name: ' דנה ', roleTitle: ' מנהלת ', phone: ' 050 ' }, { name: 'יוסי', roleTitle: '', phone: '051' }]);
    expect(r.primary).toEqual({ name: 'דנה', roleTitle: 'מנהלת', phone: '050' });
    expect(r.extras).toEqual([{ name: 'יוסי', roleTitle: null, phone: '051' }]);
  });
});
