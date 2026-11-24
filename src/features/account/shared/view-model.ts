// Pure checks for the account forms. The server repeats every rule; the database is the authority.
export const MIN_PASSWORD = 8;
export const MAX_NAME = 120;

/** Own-name editing for non-owners needs the database function `update_own_name` (not created yet, D31). Flip when it exists. */
export const NON_OWNER_CAN_EDIT_OWN_NAME = false;
export const canEditOwnName = (isOwner: boolean) => isOwner || NON_OWNER_CAN_EDIT_OWN_NAME;

export function validateName(name: string): string | undefined {
  const value = name.trim();
  if (!value) return 'יש להזין שם';
  if (value.length > MAX_NAME) return `השם ארוך מדי (עד ${MAX_NAME} תווים)`;
  return undefined;
}

export type PasswordErrors = Partial<Record<'currentPassword' | 'newPassword' | 'confirm', string>>;
export function validatePasswordChange(v: { currentPassword: string; newPassword: string; confirm: string }): PasswordErrors {
  const errors: PasswordErrors = {};
  if (!v.currentPassword) errors.currentPassword = 'יש להזין את הסיסמה הנוכחית';
  if (v.newPassword.length < MIN_PASSWORD) errors.newPassword = `הסיסמה החדשה צריכה להכיל לפחות ${MIN_PASSWORD} תווים`;
  else if (v.newPassword === v.currentPassword) errors.newPassword = 'הסיסמה החדשה זהה לנוכחית. יש לבחור סיסמה אחרת';
  if (v.confirm !== v.newPassword) errors.confirm = 'אימות הסיסמה אינו תואם לסיסמה החדשה';
  return errors;
}

const ERRORS: Record<string, string> = {
  FORBIDDEN: 'אין הרשאה לפעולה הזו.',
  CONFLICT: 'המידע השתנה מאז שפתחתם אותו. נטען מחדש, אפשר לנסות שוב.',
  UNAUTHENTICATED: 'יש להיכנס שוב.',
  RATE_LIMITED: 'יותר מדי ניסיונות. אפשר לנסות שוב בעוד רגע.',
  VALIDATION: 'יש לבדוק את הפרטים שהוזנו.',
};
/** Server codes become plain Hebrew; the raw message is never shown. */
export function accountErrorText(code: string): string {
  return ERRORS[code] ?? 'לא התקבל אישור שמירה. אפשר לנסות שוב.';
}
