import type { FinanceBook, MoneySummary } from '@/types/contracts';
import { percent, shekels } from './present';

/** Detail lines of a summary. Values are the calculated ones from the finance logic. */
export function SummaryLines({ summary, balance, previousLabel }: { summary: MoneySummary; balance: number; previousLabel?: string }) {
  const taxText = summary.tax < 0 ? `קיזוז ${shekels(Math.abs(summary.tax))}` : shekels(summary.tax);
  const rows: [string, string][] = [
    ['הוצאות שהוזנו', shekels(summary.expense)],
    ['מס 3%', taxText],
    ['סה״כ הוצאה', shekels(summary.totalExpense)],
    ['רווח נקי', shekels(summary.netProfit)],
    [previousLabel ?? 'שארית', shekels(balance)],
    ['אחוז רווח', percent(summary.profitPercentTenths)],
  ];
  return (
    <dl className="fin-lines">
      {rows.map(([label, value]) => (
        <div key={label} className="fin-lines__row"><dt>{label}</dt><dd className="fin-num">{value}</dd></div>
      ))}
    </dl>
  );
}

export function WorkDays({ book }: { book: FinanceBook }) {
  return (
    <div className="fin-workdays">
      <span className="fin-workdays__n fin-num">{book.workDays}</span>
      <span>ימי עבודה בתקופה</span>
    </div>
  );
}
