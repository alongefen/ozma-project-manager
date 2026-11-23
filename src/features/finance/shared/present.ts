import type { FinanceBook, MonthBlock, TransactionFields, TransactionKind, TransactionRow } from '@/types/contracts';
import { format } from '@/lib/format';

/** Presentation helpers only. Every amount arrives already calculated by the finance logic. */
export const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export const KIND_LABELS: Record<TransactionKind, string> = {
  income: 'הכנסה',
  income_refund: 'החזר ללקוח',
  expense: 'הוצאה',
  expense_credit: 'זיכוי ספק',
};
export const KIND_OPTIONS = (Object.keys(KIND_LABELS) as TransactionKind[]).map(value => ({ value, label: KIND_LABELS[value] }));

export const monthLabel = (m: { year: number; month: number }) => `${MONTH_NAMES[m.month - 1]} ${m.year}`;
export const shekels = (agorot: number) => format.money(agorot);
/** Negative numbers get an explicit minus; tax offsets (negative tax) read as "קיזוז". */
export const percent = (tenths: number | null) => (tenths === null ? '—' : `${(tenths / 10).toFixed(1)}%`);
export const isIncomeKind = (kind: TransactionKind) => kind === 'income' || kind === 'income_refund';
export const isReduction = (kind: TransactionKind) => kind === 'income_refund' || kind === 'expense_credit';

/** Row amount as shown: refunds and credits carry a minus sign. */
export function rowAmount(row: TransactionRow): string {
  return isReduction(row.kind) ? `−${shekels(row.amount)}` : shekels(row.amount);
}

export function rowDate(row: { year: number; month: number; day: number | null }): string {
  const mm = String(row.month).padStart(2, '0');
  return row.day === null ? `${mm}/${row.year}` : `${String(row.day).padStart(2, '0')}/${mm}/${row.year}`;
}

/** All rows of a book in display order: newest month first, then the stored position. */
export function bookRows(blocks: MonthBlock[]): TransactionRow[] {
  return blocks
    .flatMap(block => [...block.incomeRows, ...block.expenseRows])
    .sort((a, b) => b.year - a.year || b.month - a.month || a.position - b.position);
}

export function monthsNewestFirst(book: FinanceBook): MonthBlock[] {
  return [...book.months].sort((a, b) => b.summary.year - a.summary.year || b.summary.month - a.summary.month);
}

/** Agorot to the text typed in the amount field ("1000.50"); formatting only. */
export function agorotToInput(agorot: number): string {
  const whole = Math.trunc(agorot / 100);
  const cents = String(agorot % 100).padStart(2, '0');
  return cents === '00' ? String(whole) : `${whole}.${cents}`;
}

export type EntryDraft = {
  year: string; month: string; day: string; kind: TransactionKind; amount: string; details: string;
};
export function draftFromRow(row: TransactionRow): EntryDraft {
  return {
    year: String(row.year), month: String(row.month), day: row.day === null ? '' : String(row.day),
    kind: row.kind, amount: agorotToInput(row.amount), details: row.details,
  };
}

export type DraftResult =
  | { ok: true; fields: TransactionFields }
  | { ok: false; errors: Partial<Record<'month' | 'year' | 'day' | 'amount' | 'details', string>> };
