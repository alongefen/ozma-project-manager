import type { FinanceBook, TransactionRow } from '@/types/contracts/finance';

const row = (kind: TransactionRow['kind'], amount: number, details: string, position: number): TransactionRow => ({
  id: `00000000-0000-4000-8000-${String(position).padStart(12, '0')}`,
  year: 2026, month: 12, day: position === 2 ? null : 15, kind, amount, details,
  position, cancelledAt: null, revision: 1,
});

/** Synthetic amounts deliberately differ from visible rows: summaries must be copied. */
export function financeBookFixture(): FinanceBook {
  return {
    projectId: '00000000-0000-4000-8000-000000000001',
    projectName: 'פרויקט בדיקה Alpha 123',
    filter: { period: 'all', search: 'עבודה', day: 15 },
    months: [
      {
        summary: { year: 2026, month: 12, income: 987654, expense: 345678, tax: 12345,
          totalExpense: 358023, netProfit: 629631, profitPercentTenths: 637, balance: 812345 },
        incomeRows: [row('income', 12345, 'עבודה A-12 הכנסה', 1), row('income_refund', 2500, 'החזר הכנסה', 2)],
        expenseRows: [row('expense', 6789, 'הוצאה בדויה', 3), row('expense_credit', 1234, 'זיכוי בדוי', 4), row('expense', -567, 'תיקון שלילי', 5)],
      },
      {
        summary: { year: 2027, month: 1, income: 0, expense: 0, tax: 0, totalExpense: 0,
          netProfit: 0, profitPercentTenths: null, balance: 812345 },
        incomeRows: [], expenseRows: [],
      },
    ],
    period: { income: 987654, expense: 345678, tax: 12345, totalExpense: 358023,
      netProfit: 629631, profitPercentTenths: 637, balance: 812345 },
    filteredRows: { income: 9845, expense: 4988 }, workDays: 7,
    excelLink: { url: null, revision: 1 }, canWrite: false, canCancel: false,
  };
}
