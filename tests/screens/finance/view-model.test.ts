import { describe, expect, it } from 'vitest';
import type { MonthBlock, TransactionRow } from '@/types/contracts';
import { parseFilter, exportHref, financeHref, yearOptions } from '@/features/finance/shared/query';
import { parseDraft } from '@/features/finance/shared/draft';
import { agorotToInput, bookRows, draftFromRow, monthLabel, percent, rowAmount, rowDate } from '@/features/finance/shared/present';

const today = '2026-11-23';
const id = '11111111-1111-4111-8111-111111111111';
const row = (over: Partial<TransactionRow>): TransactionRow => ({
  id, year: 2026, month: 11, day: null, kind: 'income', amount: 100050, details: 'בדוי', position: 1, cancelledAt: null, revision: 1, ...over,
});

describe('סינון מהכתובת', () => {
  it('ברירת מחדל: החודש הנוכחי לפי תאריך השרת', () => {
    expect(parseFilter({}, today)).toEqual({ period: { year: 2026, month: 11 } });
  });
  it('כל התקופה, יום וחיפוש', () => {
    expect(parseFilter({ period: 'all', day: '5', search: ' ספק ' }, today)).toEqual({ period: 'all', day: 5, search: 'ספק' });
  });
  it('ערכים שגויים נופלים לברירת מחדל', () => {
    expect(parseFilter({ period: '2026-13', day: '40' }, today)).toEqual({ period: { year: 2026, month: 11 } });
    expect(parseFilter({ period: 'x', day: 'a' }, today)).toEqual({ period: { year: 2026, month: 11 } });
  });
  it('קישורים: ייצוא נושא מזהה, תקופה ומסננים', () => {
    const filter = parseFilter({ period: '2026-03', day: '2', search: 'חול' }, today);
    expect(financeHref(id, filter)).toBe(`/projects/${id}/finance?period=2026-03&day=2&search=${encodeURIComponent('חול')}`);
    const url = new URL(exportHref(id, filter), 'http://x');
    expect(url.pathname).toBe('/api/exports/finance');
    expect(url.searchParams.get('projectId')).toBe(id);
    expect(url.searchParams.get('period')).toBe('2026-03');
  });
  it('שנים כוללות את הנבחרת', () => {
    expect(yearOptions(today, 2010)).toContain(2010);
    expect(yearOptions(today)[0]).toBe(2027);
  });
});

describe('טופס הזנה', () => {
  const draft = { year: '2026', month: '11', day: '', kind: 'income' as const, amount: '1,000', details: 'בדוי' };
  it('סכום מפוענח במנוע הכסף ולא בתצוגה', () => {
    expect(parseDraft({ ...draft, amount: '1000.50' })).toMatchObject({ ok: true, fields: { amount: 100050, day: null } });
  });
  it('שגיאות שדה: סכום, פרטים, יום, חודש', () => {
    const r = parseDraft({ ...draft, amount: '0', details: ' ', day: '40', month: '13' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['amount', 'day', 'details', 'month']);
  });
  it('יום שאינו בחודש נדחה בסכמת החוזה', () => {
    const r = parseDraft({ ...draft, amount: '5', month: '2', day: '30' });
    expect(r.ok).toBe(false);
  });
  it('סכום שלילי או טקסט נדחים', () => {
    expect(parseDraft({ ...draft, amount: '-5' }).ok).toBe(false);
    expect(parseDraft({ ...draft, amount: 'abc' }).ok).toBe(false);
  });
  it('עריכה: סכום חוזר לטקסט ללא איבוד אגורות', () => {
    expect(agorotToInput(100050)).toBe('1000.50');
    expect(agorotToInput(100000)).toBe('1000');
    expect(agorotToInput(5)).toBe('0.05');
    expect(parseDraft(draftFromRow(row({ amount: 5 })))).toMatchObject({ ok: true, fields: { amount: 5 } });
  });
});

describe('הצגה', () => {
  it('החזר וזיכוי עם סימן מינוס', () => {
    expect(rowAmount(row({ kind: 'income_refund', amount: 100 }))).toContain('−');
    expect(rowAmount(row({ kind: 'expense', amount: 100 }))).not.toContain('−');
  });
  it('תאריך, חודש ואחוז', () => {
    expect(rowDate(row({ day: 3 }))).toBe('03/11/2026');
    expect(rowDate(row({ day: null }))).toBe('11/2026');
    expect(monthLabel({ year: 2026, month: 1 })).toBe('ינואר 2026');
    expect(percent(370)).toBe('37.0%');
    expect(percent(null)).toBe('—');
  });
  it('שורות: חודש חדש קודם, ואז לפי מיקום', () => {
    const blocks = [
      { summary: {} as never, incomeRows: [row({ id: 'a', month: 10, position: 2 })], expenseRows: [row({ id: 'b', month: 11, position: 3 })] },
      { summary: {} as never, incomeRows: [row({ id: 'c', month: 11, position: 1 })], expenseRows: [] },
    ] as MonthBlock[];
    expect(bookRows(blocks).map(r => r.id)).toEqual(['c', 'b', 'a']);
  });
});
