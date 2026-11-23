'use client';
import type { FinanceBook } from '@/types/contracts';
import { SummaryDetails } from './Summary';
import { useFinanceNav } from './nav';
import { KIND_LABELS, bookRows, isIncomeKind, monthLabel, rowAmount, rowDate, shekels, visibleRows } from './present';

/**
 * What the print button prints: the summary and the full list of transactions of the shown period
 * (grouped by month), not the screen layout. Hidden on screen, the only thing shown when printing.
 * Amounts and totals are the ones calculated by the finance logic.
 */
export function PrintView({ book, filteredRows }: { book: FinanceBook; filteredRows: FinanceBook['filteredRows'] }) {
  const { filter, totalsReady } = useFinanceNav();
  const period = filter.period;
  const narrowed = filter.day !== undefined || !!filter.search;
  const blocks = [...book.months]
    .sort((a, b) => a.summary.year - b.summary.year || a.summary.month - b.summary.month)
    .map(block => ({ block, rows: visibleRows(bookRows([block]), filter) }))
    .filter(({ rows }) => rows.length > 0);

  return (
    <section className="fin-print" aria-hidden="true">
      <h1>כספים: {book.projectName}</h1>
      <p className="fin-print__sub">
        {period === 'all' ? 'כל התקופה' : monthLabel(period)}
        {filter.day !== undefined && ` · יום ${filter.day}`}
        {filter.search && ` · חיפוש: ${filter.search}`}
      </p>
      <div className="fin-kpis">
        <div><span>הכנסות בתקופה</span><strong className="fin-num">{shekels(book.period.income)}</strong></div>
        <div><span>סה״כ הוצאה כולל מס 3%</span><strong className="fin-num">{shekels(book.period.totalExpense)}</strong></div>
        <div><span>רווח נקי</span><strong className="fin-num">{shekels(book.period.netProfit)}</strong></div>
      </div>
      <SummaryDetails book={book} balanceLabel={period === 'all' ? 'שארית בסוף התקופה' : 'שארית חודש'} />
      <h2>פירוט תנועות</h2>
      {blocks.length === 0 ? <p>אין תנועות בתקופה</p> : (
        <table className="fin-table">
          <thead><tr><th scope="col">תאריך</th><th scope="col">פרטים / ספק</th><th scope="col">הכנסה</th><th scope="col">הוצאה</th></tr></thead>
          {blocks.map(({ block, rows }) => (
            <tbody key={`${block.summary.year}-${block.summary.month}`}>
              <tr className="fin-print__month">
                <th colSpan={4} scope="colgroup">
                  {monthLabel(block.summary)}
                  {!narrowed && <span> · הכנסות {shekels(block.summary.income)} · סה״כ הוצאה {shekels(block.summary.totalExpense)} · שארית חודש {shekels(block.summary.balance)}</span>}
                </th>
              </tr>
              {rows.map(row => (
                <tr key={row.id}>
                  <td className="fin-num">{rowDate(row)}</td>
                  <td>{row.details}{row.kind !== 'income' && row.kind !== 'expense' && ` (${KIND_LABELS[row.kind]})`}</td>
                  <td className="fin-num">{isIncomeKind(row.kind) ? rowAmount(row) : ''}</td>
                  <td className="fin-num">{!isIncomeKind(row.kind) ? rowAmount(row) : ''}</td>
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot>
            <tr><th scope="row" colSpan={2}>{narrowed ? 'סיכום התנועות המוצגות' : 'סיכום התנועות'}</th><td className="fin-num">{totalsReady ? shekels(filteredRows.income) : ''}</td><td className="fin-num">{totalsReady ? shekels(filteredRows.expense) : ''}</td></tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}
