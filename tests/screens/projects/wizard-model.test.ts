import { describe, expect, it } from 'vitest';
import { emptyValues, type FormValues } from '@/features/projects/shared/form-model';
import { LAST_FORM_STEP, STEPS, firstStepWithError, roleAction, stepFields, stepOfField, validateStep } from '@/features/projects/shared/wizard-model';

const ok = (): FormValues => ({ ...emptyValues(), name: 'בית', businessName: 'עסק', siteAddress: 'רחוב 1', contactName: 'דנה', contactPhone: '0500000000' });

describe('new project wizard model', () => {
  it('has the five steps in the agreed order, the project is created after the notes step', () => {
    expect(STEPS.map(s => s.key)).toEqual(['details', 'contact', 'notes', 'access', 'cover']);
    expect(STEPS[LAST_FORM_STEP].key).toBe('notes');
  });
  it('maps every form field to exactly one step, and none to the access and cover steps', () => {
    expect(stepFields(0)).toContain('name');
    expect(stepFields(1)).toContain('contactPhone');
    expect(stepFields(2)).toEqual(['accessNotes']);
    expect(stepFields(3)).toEqual([]);
    expect(stepOfField('endDate')).toBe(0);
    expect(stepOfField('contactEmail')).toBe(1);
  });
  it('checks only the fields of the current step', () => {
    const empty = emptyValues();
    expect(Object.keys(validateStep(empty, 0)).sort()).toEqual(['businessName', 'name', 'siteAddress']);
    expect(Object.keys(validateStep(empty, 1)).sort()).toEqual(['contactName', 'contactPhone']);
    expect(validateStep(empty, 2)).toEqual({});
    expect(validateStep(ok(), 0)).toEqual({});
  });
  it('rejects a bad email on the contact step and an end before the start on the first', () => {
    expect(validateStep({ ...ok(), contactEmail: 'x' }, 1).contactEmail).toBeTruthy();
    expect(validateStep({ ...ok(), startDate: '2026-05-10', endDate: '2026-05-01' }, 0).endDate).toBeTruthy();
  });
  it('finds the earliest step with an error, or -1', () => {
    expect(firstStepWithError({ contactPhone: 'x', name: 'y' })).toBe(0);
    expect(firstStepWithError({ contactPhone: 'x' })).toBe(1);
    expect(firstStepWithError({})).toBe(-1);
  });
  it('maps a role change to the server operation', () => {
    expect(roleAction('none', 'worker')).toBe('add');
    expect(roleAction('worker', 'manager')).toBe('change');
    expect(roleAction('manager', 'none')).toBe('remove');
    expect(roleAction('worker', 'worker')).toBe('noop');
  });
});
