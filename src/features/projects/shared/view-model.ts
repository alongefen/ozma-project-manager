// Pure view model for the project file. Decides what each viewer sees; the database stays the
// authority (hiding a button is not a permission). No calculation of money or counts here.
import type { ProjectDetails } from '@/types/contracts';

export const NOT_ENTERED = 'לא הוזן';
export const NO_MANAGER = 'לא שויך מנהל';

export type Section = { key: 'tasks' | 'files' | 'diary' | 'notes' | 'finance'; label: string; href: string };

/** Entry rows to the project's sections. Finance only when the database says this viewer may see it. */
export function sectionsFor(d: Pick<ProjectDetails, 'id' | 'permissions'>): Section[] {
  const base = `/projects/${d.id}`;
  const list: Section[] = [
    { key: 'files', label: 'מסמכים', href: `${base}/files` },
    { key: 'tasks', label: 'משימות', href: `${base}/tasks` },
    { key: 'diary', label: 'יומן', href: `${base}/diary` },
    { key: 'notes', label: 'הערות', href: `${base}/notes` },
  ];
  if (d.permissions.viewFinance) list.push({ key: 'finance', label: 'כספים', href: `${base}/finance` });
  return list;
}

export function statusLabel(d: Pick<ProjectDetails, 'status' | 'archived'>): string {
  if (d.archived) return 'בארכיון';
  return d.status === 'completed' ? 'הסתיים' : 'פעיל';
}

export function isReadOnlyProject(d: Pick<ProjectDetails, 'status' | 'archived'>): boolean {
  return d.archived || d.status === 'completed';
}

export const READ_ONLY_NOTICE = 'הפרויקט הסתיים או בארכיון. אפשר לצפות ולהדפיס בלבד.';

export function orNotEntered(value: string | null | undefined): string {
  return value && value.trim() ? value : NOT_ENTERED;
}

/**
 * The database requires a primary contact (name and phone), but the wizard no longer does (A-45): a project created
 * without any contact stores this placeholder, and the screens show "not entered" instead of it.
 */
export const NO_CONTACT = { name: 'לא הוזן', phone: '-' } as const;
export function isPlaceholderContact(c: { name: string; phone: string }): boolean {
  return c.name === NO_CONTACT.name && c.phone === NO_CONTACT.phone;
}

export function managersText(names: string[]): string {
  return names.length ? names.join(', ') : NO_MANAGER;
}

/** Digits only for a tel: link; null when there is nothing dialable. */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 5 ? `tel:${digits}` : null;
}

/** Date as dd.mm.yyyy for display (ISO in, no time zone maths). */
export function dateText(iso: string | null): string {
  if (!iso) return NOT_ENTERED;
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : NOT_ENTERED;
}

export type Actions = { edit: boolean; manage: boolean };

/** What the viewer may be offered. "manage" (status, archive, cover, assignment) is the owner's: manageAccess. */
export function actionsFor(d: Pick<ProjectDetails, 'permissions'>): Actions {
  return { edit: d.permissions.editDetails, manage: d.permissions.manageAccess };
}

export function coverSrc(fileId: string | null): string | null {
  return fileId ? `/api/storage/files/${fileId}?variant=display` : null;
}

export const ERROR_TEXT: Record<string, string> = {
  CONFLICT: 'המידע השתנה מאז שפתחתם אותו. טענו מחדש ונסו שוב.',
  FORBIDDEN: 'אין הרשאה לפעולה הזו.',
  NOT_FOUND: 'הפריט אינו זמין.',
  PROJECT_READ_ONLY: 'הפרויקט הסתיים או בארכיון, ולכן אי אפשר לשנות אותו.',
  UNAUTHENTICATED: 'יש להיכנס שוב.',
  UNAVAILABLE: 'לא התקבל אישור שמירה. אפשר לנסות שוב.',
};
export function errorText(code: string, fallback?: string): string {
  return ERROR_TEXT[code] ?? fallback ?? ERROR_TEXT.UNAVAILABLE;
}
