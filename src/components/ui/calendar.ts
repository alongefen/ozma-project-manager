/** Pure date helpers for DateField. Dates are ISO strings (YYYY-MM-DD), calendar days only, no time zones. */
export const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
/** Sunday first. */
export const WEEKDAYS_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
export const WEEKDAYS_LONG_HE = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
export const toIso = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Parses a real calendar date or returns null (so `2026-02-31` is rejected). */
export function parseIso(value: string | null | undefined): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

/** DD/MM/YYYY for display; empty for a missing or invalid value. */
export function formatDisplay(value: string | null | undefined): string {
  const p = parseIso(value);
  return p ? `${pad(p.d)}/${pad(p.m)}/${pad(p.y, 4)}` : '';
}

export function addDays(iso: string, delta: number): string {
  const p = parseIso(iso)!;
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + delta));
  return toIso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Moves by whole months, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, delta: number): string {
  const p = parseIso(iso)!;
  const index = p.y * 12 + (p.m - 1) + delta;
  const y = Math.floor(index / 12), m = (index % 12 + 12) % 12 + 1;
  return toIso(y, m, Math.min(p.d, daysInMonth(y, m)));
}

/** The visible grid of a month: 6 weeks of 7 days starting on Sunday, with `inMonth` marking the month's own days. */
export function monthGrid(y: number, m: number): { iso: string; day: number; inMonth: boolean }[] {
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = Sunday
  const first = toIso(y, m, 1);
  return Array.from({ length: 42 }, (_, i) => {
    const iso = addDays(first, i - firstWeekday);
    const p = parseIso(iso)!;
    return { iso, day: p.d, inMonth: p.m === m && p.y === y };
  });
}

export function todayIso(now = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
