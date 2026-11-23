// Pure view model for the people screens. No calculation of money; only labels, filtering and form checks.
// The database stays the authority: hiding a button is not a permission.
import type { ProjectCard, ProjectRole, UserAssignment, UserRow } from '@/types/contracts';

export const ROLE_LABEL: Record<ProjectRole, string> = { manager: 'מנהל', worker: 'עובד' };
export const MIN_PASSWORD = 8;

const ERROR_TEXT: Record<string, string> = {
  CONFLICT: 'המידע השתנה מאז שפתחתם אותו. הנתונים נטענו מחדש, אפשר לנסות שוב.',
  FORBIDDEN: 'אין הרשאה לפעולה הזו.',
  NOT_FOUND: 'הפריט אינו זמין.',
  VALIDATION: 'יש לבדוק את הפרטים שהוזנו.',
  PROJECT_READ_ONLY: 'הפרויקט הסתיים או בארכיון, ולכן אי אפשר לשנות בו גישה.',
  UNAUTHENTICATED: 'יש להיכנס שוב.',
  RATE_LIMITED: 'יותר מדי ניסיונות. אפשר לנסות שוב בעוד רגע.',
  UNAVAILABLE: 'לא התקבל אישור שמירה. אפשר לנסות שוב.',
};
/** Server errors are always shown as plain Hebrew, never the raw message. */
export function errorText(code: string, context?: 'create'): string {
  if (context === 'create' && code === 'CONFLICT') return 'כתובת האימייל הזו כבר רשומה במערכת.';
  return ERROR_TEXT[code] ?? ERROR_TEXT.UNAVAILABLE;
}

const key = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

/** Client-side search over the fully loaded list (name, email, project names). */
export function filterUsers(users: UserRow[], search: string): UserRow[] {
  const q = key(search);
  if (!q) return users;
  return users.filter(u => key(`${u.fullName} ${u.email} ${u.assignments.map(a => a.projectName).join(' ')}`).includes(q));
}

export function sortUsers(users: UserRow[]): UserRow[] {
  return [...users].sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || Number(b.isActive) - Number(a.isActive) || a.fullName.localeCompare(b.fullName, 'he'));
}

export function assignmentLabel(a: Pick<UserAssignment, 'projectName' | 'role'>): string {
  return `${a.projectName} · ${ROLE_LABEL[a.role]}`;
}

export function statusLabel(u: Pick<UserRow, 'isOwner' | 'isActive'>): string {
  if (u.isOwner) return 'מנהל מערכת';
  return u.isActive ? 'פעיל' : 'מושבת';
}

/** Projects the person can still be added to: open (not finished, not archived) and not already assigned. */
export function addableProjects(projects: ProjectCard[], assignments: Pick<UserAssignment, 'projectId'>[]): ProjectCard[] {
  const taken = new Set(assignments.map(a => a.projectId));
  return projects.filter(p => p.status === 'active' && !p.archived && !taken.has(p.id));
}

export type NewPersonErrors = Partial<Record<'fullName' | 'email' | 'password', string>>;
export function validateNewPerson(v: { fullName: string; email: string; password: string }): NewPersonErrors {
  const errors: NewPersonErrors = {};
  if (!v.fullName.trim()) errors.fullName = 'יש להזין שם';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) errors.email = 'יש להזין כתובת אימייל תקינה';
  if (v.password.length < MIN_PASSWORD) errors.password = `הסיסמה צריכה להכיל לפחות ${MIN_PASSWORD} תווים`;
  return errors;
}
export function validatePassword(password: string): string | undefined {
  return password.length < MIN_PASSWORD ? `הסיסמה צריכה להכיל לפחות ${MIN_PASSWORD} תווים` : undefined;
}
