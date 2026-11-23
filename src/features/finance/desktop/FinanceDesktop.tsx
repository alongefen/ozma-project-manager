'use client';
import { Fragment, useState } from 'react';
import Link from 'next/link';
import type { FinanceBook, FinanceFilter, TransactionRow } from '@/types/contracts';
import { Button, Card, Notice } from '@/components/ui';
import { EntryForm } from '../shared/EntryForm';
import { ExcelLink } from '../shared/ExcelLink';
import { Filters } from '../shared/Filters';
import { SummaryLines, WorkDays } from '../shared/Summary';
import { KIND_LABELS, bookRows, isIncomeKind, monthLabel, monthsNewestFirst, rowAmount, rowDate, shekels } from '../shared/present';
import { currentMonth, exportHref, financeHref } from '../shared/query';

type Props = { book: FinanceBook; filter: FinanceFilter; today: string };

/** Desktop (from 1024): the demo layout. Filters, three stats, quick entry, table, two summary panels. */
export function FinanceDesktop({ book, filter, today }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const rows = bookRows(book.months);
  const period = filter.period;
  const entryMonth = period === 'all' ? currentMonth(today) : period;
  const filtered = filter.day !== undefined || !!filter.search;
  const label = period === 'all' ? 'כל התקופה' : monthLabel(period);

  return (
    <div className="fin fin-desktop d-only">
      <div className="fin-head">
        <div>
          <h1 className="ui-page-title">כספים: {book.projectName}</h1>
          <p className="ui-sub">{label}</p>
        </div>
        <div className="fin-head__actions">
          <a className="ui-btn ui-btn--secondary ui-btn--small" href={exportHref(book.projectId, filter)}>ייצוא ל-Excel</a>
          <Button variant="secondary" size="small" onClick={() => window.print()}>הדפסה</Button>
          <ExcelLink projectId={book.projectId} link={book.excelLink} canWrite={book.canWrite} />
        </div>
      </div>

      <Card className="fin-panel"><Filters projectId={book.projectId} filter={filter} today={today} /></Card>

      <div className="fin-stats">
        <Card className="fin-stat"><span>הכנסות בתקופה</span><strong className="fin-num">{shekels(book.period.income)}</strong></Card>
        <Card className="fin-stat"><span>סה״כ הוצאה כולל מס 3%</span><strong className="fin-num">{shekels(book.period.totalExpense)}</strong></Card>
        <Card className="fin-stat"><span>רווח נקי</span><strong className="fin-num">{shekels(book.period.netProfit)}</strong></Card>
      </div>

      {book.canWrite ? (
        <Card className="fin-panel fin-quick no-print">
          <h2>הזנה מהירה</h2>
          <EntryForm projectId={book.projectId} today={today} row={null} defaultMonth={entryMonth} variant="inline" canCancel={false} onDone={() => undefined} />
        </Card>
      ) : (
        <Notice>הפרויקט זמין לצפייה והדפסה בלבד.</Notice>
      )}

      <Card className="fin-panel fin-tablewrap">
        <table className="fin-table">
          <caption className="sr-only">תנועות כספיות</caption>
          <thead>
            <tr><th scope="col">תאריך</th><th scope="col">פרטים / ספק</th><th scope="col">הכנסה</th><th scope="col">הוצאה</th><th scope="col" className="no-print">פעולות</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="fin-empty">
                {filtered ? 'לא נמצאו תנועות' : 'אין תנועות בתקופה'}
                {filtered && <> · <Link href={financeHref(book.projectId, { period })}>איפוס סינון</Link></>}
              </td></tr>
            )}
            {rows.map((row: TransactionRow) => (
              <Fragment key={row.id}>
                <tr>
                  <td className="fin-num">{rowDate(row)}</td>
                  <td className="fin-details">{row.details}{row.kind !== 'income' && row.kind !== 'expense' && <span className="fin-kind">{KIND_LABELS[row.kind]}</span>}</td>
                  <td className="fin-num">{isIncomeKind(row.kind) ? rowAmount(row) : ''}</td>
                  <td className="fin-num">{!isIncomeKind(row.kind) ? rowAmount(row) : ''}</td>
                  <td className="no-print">{book.canWrite && <Button variant="secondary" size="small" onClick={() => setEditing(editing === row.id ? null : row.id)}>{editing === row.id ? 'סגירה' : 'עריכה'}</Button>}</td>
                </tr>
                {editing === row.id && (
                  <tr className="fin-editrow"><td colSpan={5}>
                    <EntryForm projectId={book.projectId} today={today} row={row} defaultMonth={entryMonth} variant="inline" canCancel={book.canCancel} onDone={() => setEditing(null)} />
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row" colSpan={2}>סיכום התנועות המוצגות</th><td className="fin-num">{shekels(book.filteredRows.income)}</td><td className="fin-num">{shekels(book.filteredRows.expense)}</td><td className="no-print" /></tr>
          </tfoot>
        </table>
      </Card>

      <div className="fin-summary">
        <Card className="fin-panel">
          <h2>סיכום התקופה</h2>
          <SummaryLines summary={book.period} balance={book.period.balance} previousLabel="שארית בסוף התקופה" />
        </Card>
        <Card className="fin-panel">
          <h2>ימי עבודה</h2>
          <WorkDays book={book} />
        </Card>
      </div>

      {period === 'all' && (
        <Card className="fin-panel">
          <h2>פירוט חודשים</h2>
          <table className="fin-table fin-months">
            <thead><tr><th scope="col">חודש</th><th scope="col">הכנסות</th><th scope="col">סה״כ הוצאה</th><th scope="col">רווח נקי</th><th scope="col">שארית חודש</th></tr></thead>
            <tbody>
              {monthsNewestFirst(book).map(({ summary: s }) => (
                <tr key={`${s.year}-${s.month}`}>
                  <th scope="row"><Link href={financeHref(book.projectId, { period: { year: s.year, month: s.month } })}>{monthLabel(s)}</Link></th>
                  <td className="fin-num">{shekels(s.income)}</td><td className="fin-num">{shekels(s.totalExpense)}</td>
                  <td className="fin-num">{shekels(s.netProfit)}</td><td className="fin-num">{shekels(s.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
