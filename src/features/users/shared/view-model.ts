// Pure view model for the people screens. No calculation of money; only labels, filtering and form checks.
// The database stays the authority: hiding a button is not a permission.
import type { ProjectCard, ProjectRole, UserAssignment, UserRow } from '@/types/contracts';

export const ROLE_LABEL: Record<ProjectRole, string> = { manager: 'מנהל', worker: 'עובד' };
export const MIN_PASSWORD = 8;
/** Owner-level account, shown to everyone as "אדמין" (A-43). Distinct from project manager (מנהל) and worker (עובד). */
export const ADMIN_LABEL = 'אדמין';

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
export type OwnerAction = 'promote' | 'demote' | 'deactivate';
const OWNER_REFUSAL: Record<OwnerAction, string> = {
  promote: 'אי אפשר להפוך את החשבון הזה לאדמין. ייתכן שהוא מושבת או שזה החשבון שלכם.',
  demote: 'אי אפשר להסיר את ההרשאה: אי אפשר להסיר אותה מעצמכם, ותמיד חייב להישאר אדמין פעיל אחד לפחות.',
  deactivate: 'אי אפשר להשבית את החשבון: אי אפשר להשבית את עצמכם, ותמיד חייב להישאר אדמין פעיל אחד לפחות.',
};
/** Text for a refused admin action. The server returns one FORBIDDEN for every rule, so the screen names the likely reasons. */
export function ownerErrorText(code: string, action: OwnerAction): string {
  return code === 'FORBIDDEN' ? OWNER_REFUSAL[action] : errorText(code);
}

/** Server errors are always shown as plain Hebrew, never the raw message. */
export function errorText(code: string, context?: 'create'): string {
  if (context === 'create' && code === 'CONFLICT') return 'כתובת האימייל הזו כבר רשומה במערכת.';
  return ERROR_TEXT[code] ?? ERROR_TEXT.UNAVAILABLE;
}

const key = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

export type UserFilter = { search: string; projectId: string; role: '' | ProjectRole | 'owner'; status: '' | 'active' | 'inactive' };
export const EMPTY_FILTER: UserFilter = { search: '', projectId: '', role: '', status: '' };
export const NO_PROJECT = 'none';

/**
 * Client-side search and filters over the fully loaded list (no round trip). Project: people with access to it
 * (`none`: people with no project). Role: the role on that project, or on any project when none is chosen
 * (`owner`: the system owner). Status: active or deactivated.
 */
export function filterUsers(users: UserRow[], f: UserFilter | string): UserRow[] {
  const filter = typeof f === 'string' ? { ...EMPTY_FILTER, search: f } : f;
  const q = key(filter.search);
  return users.filter(u => {
    if (q && !key(`${u.fullName} ${u.email} ${u.assignments.map(a => a.projectName).join(' ')}`).includes(q)) return false;
    if (filter.status === 'active' && !u.isActive) return false;
    if (filter.status === 'inactive' && u.isActive) return false;
    if (filter.projectId === NO_PROJECT && (u.assignments.length > 0 || u.isOwner)) return false;
    const inProject = filter.projectId && filter.projectId !== NO_PROJECT ? u.assignments.filter(a => a.projectId === filter.projectId) : u.assignments;
    if (filter.projectId && filter.projectId !== NO_PROJECT && inProject.length === 0) return false;
    if (filter.role === 'owner') return u.isOwner;
    if (filter.role && !inProject.some(a => a.role === filter.role)) return false;
    return true;
  });
}

/** Projects any listed person has access to, for the project filter (names come with the assignments). */
export function projectOptions(users: UserRow[], projects: Pick<ProjectCard, 'id' | 'name'>[] = []): { id: string; name: string }[] {
  const map = new Map<string, string>(projects.map(p => [p.id, p.name]));
  for (const u of users) for (const a of u.assignments) map.set(a.projectId, a.projectName);
  return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

export function sortUsers(users: UserRow[]): UserRow[] {
  return [...users].sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || Number(b.isActive) - Number(a.isActive) || a.fullName.localeCompare(b.fullName, 'he'));
}

export function activeAdminCount(users: Pick<UserRow, 'isOwner' | 'isActive'>[]): number {
  return users.filter(u => u.isOwner && u.isActive).length;
}

export type AdminControls = {
  /** Promote button (plain, active person). */
  canPromote: boolean;
  /** Demote / deactivate / reset are shown for admins other than yourself. */
  isSelf: boolean;
  /** Why demote and deactivate are disabled (the last active admin), or null. */
  lastAdminReason: string | null;
};
export const LAST_ADMIN_REASON = 'זה האדמין האחרון במערכת. כדי להסיר אותו צריך קודם להפוך אדם אחר לאדמין.';
/** Which admin controls the person sheet offers. The server stays the authority; this only avoids offering what it refuses. */
export function adminControls(user: Pick<UserRow, 'id' | 'isOwner' | 'isActive'>, all: Pick<UserRow, 'isOwner' | 'isActive'>[], viewerId: string): AdminControls {
  const isSelf = user.id === viewerId;
  return {
    canPromote: !user.isOwner && user.isActive && !isSelf,
    isSelf,
    lastAdminReason: user.isOwner && user.isActive && activeAdminCount(all) <= 1 ? LAST_ADMIN_REASON : null,
  };
}

export function assignmentLabel(a: Pick<UserAssignment, 'projectName' | 'role'>): string {
  return `${a.projectName} · ${ROLE_LABEL[a.role]}`;
}

export function statusLabel(u: Pick<UserRow, 'isOwner' | 'isActive'>): string {
  if (u.isOwner) return ADMIN_LABEL;
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
export { validateName } from '@/features/account/shared/view-model';
