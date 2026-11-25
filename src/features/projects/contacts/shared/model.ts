import { telHref } from '../../shared/view-model';
import type { ContactRow } from '../logic/schemas';

export type ContactDraft = { name: string; roleTitle: string; phone: string };
export type ContactErrors = Partial<Record<keyof ContactDraft, string>>;
export const emptyDraft = (): ContactDraft => ({ name: '', roleTitle: '', phone: '' });
export const draftOf = (c: ContactRow | null): ContactDraft => (c ? { name: c.name, roleTitle: c.roleTitle ?? '', phone: c.phone } : emptyDraft());

export function parseDraft(d: ContactDraft): { ok: true; name: string; roleTitle: string | null; phone: string } | { ok: false; errors: ContactErrors } {
  const errors: ContactErrors = {};
  const name = d.name.trim(), roleTitle = d.roleTitle.trim(), phone = d.phone.trim();
  if (!name) errors.name = 'שדה חובה'; else if (name.length > 120) errors.name = 'יש לבדוק את הערך שהוזן';
  if (!phone) errors.phone = 'שדה חובה'; else if (phone.length > 40) errors.phone = 'יש לבדוק את הערך שהוזן';
  if (roleTitle.length > 120) errors.roleTitle = 'יש לבדוק את הערך שהוזן';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, name, roleTitle: roleTitle || null, phone };
}

/** The phone is a tap-to-call link when it has enough digits (same rule as the main contact). */
export const callHref = (phone: string): string | null => telHref(phone);
