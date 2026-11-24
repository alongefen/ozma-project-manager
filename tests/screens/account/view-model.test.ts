import { describe, expect, it } from 'vitest';
import { accountErrorText, canEditOwnName, validateName, validatePasswordChange } from '@/features/account/shared/view-model';

describe('account view model', () => {
  it('name must be present and at most 120 characters', () => {
    expect(validateName('  ')).toBe('יש להזין שם');
    expect(validateName('א'.repeat(121))).toContain('120');
    expect(validateName(' דנה ')).toBeUndefined();
  });
  it('password change needs current, 8+ new, different, and a matching confirmation', () => {
    expect(validatePasswordChange({ currentPassword: '', newPassword: 'abc', confirm: 'x' })).toEqual({
      currentPassword: 'יש להזין את הסיסמה הנוכחית', newPassword: 'הסיסמה החדשה צריכה להכיל לפחות 8 תווים', confirm: 'אימות הסיסמה אינו תואם לסיסמה החדשה',
    });
    expect(validatePasswordChange({ currentPassword: 'password-1', newPassword: 'password-1', confirm: 'password-1' }).newPassword).toContain('זהה');
    expect(validatePasswordChange({ currentPassword: 'password-1', newPassword: 'password-2', confirm: 'password-2' })).toEqual({});
  });
  it('own-name editing is offered to admins only (decision 24.11.2026)', () => {
    expect(canEditOwnName(true)).toBe(true);
    expect(canEditOwnName(false)).toBe(false);
  });
  it('server codes become Hebrew, unknown codes a safe default', () => {
    expect(accountErrorText('RATE_LIMITED')).toContain('ניסיונות');
    expect(accountErrorText('whatever')).toContain('לא התקבל אישור');
  });
});
