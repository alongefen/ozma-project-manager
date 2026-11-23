import { parseShekels } from '@/lib/money';
import { TransactionFieldsSchema } from '@/types/contracts/schemas';
import type { DraftResult, EntryDraft } from './present';

/**
 * Turns the typed form into contract fields. Amount parsing is the shared money parser; the
 * contract schema (the same one the server uses) decides the rest, so the screen invents no rules.
 */
export function parseDraft(draft: EntryDraft): DraftResult {
  const errors: Partial<Record<'month' | 'year' | 'day' | 'amount' | 'details', string>> = {};
  const year = Number(draft.year);
  const month = Number(draft.month);
  if (!Number.isInteger(month) || month < 1 || month > 12) errors.month = 'יש לבחור חודש';
  if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.year = 'יש לבחור שנה';
  const dayText = draft.day.trim();
  const day = dayText === '' ? null : Number(dayText);
  if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) errors.day = 'יום בין 1 ל-31';
  const amount = parseShekels(draft.amount);
  if (!amount.ok) errors.amount = 'יש להזין סכום תקין';
  else if (amount.value <= 0) errors.amount = 'הסכום חייב להיות גדול מאפס';
  if (!draft.details.trim()) errors.details = 'יש להזין פרטים';
  if (Object.keys(errors).length > 0 || !amount.ok) return { ok: false, errors };
  const parsed = TransactionFieldsSchema.safeParse({ year, month, day, kind: draft.kind, amount: amount.value, details: draft.details });
  if (parsed.success) return { ok: true, fields: parsed.data };
  const path = parsed.error.issues[0]?.path[0];
  const key = path === 'day' || path === 'amount' || path === 'details' || path === 'month' || path === 'year' ? path : 'details';
  return { ok: false, errors: { [key]: parsed.error.issues[0]?.message ?? 'יש לבדוק את הפרטים' } };
}
