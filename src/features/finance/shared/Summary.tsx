import type { FinanceBook } from '@/types/contracts';
import { percent, shekels } from './present';

/** The one period summary, shown at the top of both screens. Values are the calculated ones from the finance logic. */
export function SummaryDetails({ book, balanceLabel }: { book: FinanceBook; balanceLabel: string }) {
  const p = book.period;
  const rows: [string, string][] = [
    ['הוצאות שהוזנו', shekels(p.expense)],
    ['מס 3%', p.tax < 0 ? `קיזוז ${shekels(Math.abs(p.tax))}` : shekels(p.tax)],
    [balanceLabel, shekels(p.balance)],
    ['אחוז רווח', percent(p.profitPercentTenths)],
    ['ימי עבודה', String(book.workDays)],
  ];
  return (
    <dl className="fin-details-list">
      {rows.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd className="fin-num">{value}</dd></div>
      ))}
    </dl>
  );
}
