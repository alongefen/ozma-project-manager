// HARD-DELETE (A-44): pure rules for the permanent-delete dialog. The server (database function) is the authority;
// this only decides what to show.
export type HardKind = 'project' | 'document' | 'entry' | 'transaction';
export type HardCounts = Record<string, number>;

/** The button is shown to owner-level accounts only, and only on a cancelled/archived/finished item. */
export function canOfferHardDelete(isOwner: boolean, kind: HardKind, s: { archived?: boolean; completed?: boolean; cancelled?: boolean }): boolean {
  if (!isOwner) return false;
  if (kind === 'project') return !!(s.archived || s.completed);
  if (kind === 'document') return !!s.archived;
  return !!s.cancelled;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `${n} ${one}` : `${n} ${many}`);

/** What will be deleted, in plain Hebrew, from the counts the server returned. */
export function deletionSummary(kind: HardKind, name: string | null, c: HardCounts): string[] {
  if (kind === 'project') {
    return [`הפרויקט ״${name ?? ''}״ וכל מה שבתוכו:`,
      plural(c.reports ?? 0, 'דיווח יומן (עם כל גרסאותיו)', 'דיווחי יומן (עם כל גרסאותיהם)'),
      plural(c.documents ?? 0, 'מסמך', 'מסמכים'),
      plural(c.transactions ?? 0, 'תנועה כספית', 'תנועות כספיות'),
      plural(c.files ?? 0, 'קובץ באחסון', 'קבצים באחסון')];
  }
  if (kind === 'document') return [`המסמך ״${name ?? ''}״ והקובץ שלו.`];
  if (kind === 'entry') return [`דיווח היומן מתאריך ${name ?? ''}, כל גרסאותיו${(c.files ?? 0) > 0 ? ` ו-${plural(c.files, 'קובץ מצורף', 'קבצים מצורפים')}` : ''}.`];
  return ['התנועה הכספית וההיסטוריה שלה.'];
}

export const IRREVERSIBLE = 'אי אפשר לשחזר. אין גיבוי, והמחיקה סופית.';

/** Typed-name check: same text after trimming (the server checks again). */
export function nameMatches(typed: string, required: string | null): boolean {
  return required !== null && typed.trim() === required.trim() && required.trim().length > 0;
}

export const AFTER_DELETE_NOTE = 'הפריט נמחק, אך ניקוי חלק מהקבצים באחסון לא הושלם. הוא יושלם אוטומטית במחיקה הבאה.';
