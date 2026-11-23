'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { FinanceBook, ProjectDetails, TransactionRow } from '@/types/contracts';
import { Button, Card, Notice } from '@/components/ui';
import { EntryForm } from '../shared/EntryForm';
import { ExcelLink } from '../shared/ExcelLink';
import { Filters } from '../shared/Filters';
import { EntrySheet } from '../shared/EntrySheet';
import { CancelConfirm } from '../shared/CancelConfirm';
import { ExcelIcon, PencilIcon, TrashIcon } from '../shared/FinIcons';
import { SummaryDetails } from '../shared/Summary';
import { useFinanceNav } from '../shared/nav';
import { KIND_LABELS, bookRows, isIncomeKind, monthLabel, monthsNewestFirst, rowAmount, rowDate, shekels } from '../shared/present';
import { ProjectInnerNav } from '@/features/projects/shared/ProjectInnerNav';
import { sectionsFor } from '@/features/projects/shared/view-model';
import { currentMonth, exportHref, financeHref } from '../shared/query';

type Props = { book: FinanceBook; today: string };

/** Desktop (from 1024): the demo's content in one panel: summary on top, filters, quick entry, table. */
export function FinanceDesktop({ book, today }: Props) {
  const { filter } = useFinanceNav();
  const [dialog, setDialog] = useState<{ row: TransactionRow | null } | null>(null);
  const [cancelRow, setCancelRow] = useState<TransactionRow | null>(null);
  const rows = bookRows(book.months);
  const period = filter.period;
  const entryMonth = period === 'all' ? currentMonth(today) : period;
  const filtered = filter.day !== undefined || !!filter.search;
  const label = period === 'all' ? 'כל התקופה' : monthLabel(period);

  return (
    <div className="fin fin-desktop d-only">
      <Link href="/projects" className="fin-backlink">‹ חזרה לפרויקטים</Link>
      <div className="fin-head">
        <h1 className="ui-page-title">{book.projectName}</h1>
        <div className="fin-head__actions">
          {book.canWrite && <Button size="small" onClick={() => setDialog({ row: null })}>הוספת תנועה</Button>}
          <a className="ui-btn ui-btn--secondary ui-btn--small" href={exportHref(book.projectId, filter)}><ExcelIcon size={20} /> ייצוא ל-Excel</a>
          <Button variant="secondary" size="small" onClick={() => window.print()}>הדפסה</Button>
          <ExcelLink projectId={book.projectId} link={book.excelLink} canWrite={book.canWrite} />
        </div>
      </div>
      <ProjectInnerNav projectId={book.projectId} sections={sectionsFor({ id: book.projectId, permissions: { viewFinance: true } as ProjectDetails['permissions'] })} current="finance" />

      <Card className="fin-main">
        <section className="fin-summary" aria-label={`סיכום ${label}`}>
          <h2 className="fin-period">{label}</h2>
          <div className="fin-kpis">
            <div><span>הכנסות בתקופה</span><strong className="fin-num">{shekels(book.period.income)}</strong></div>
            <div><span>סה״כ הוצאה כולל מס 3%</span><strong className="fin-num">{shekels(book.period.totalExpense)}</strong></div>
            <div><span>רווח נקי</span><strong className="fin-num">{shekels(book.period.netProfit)}</strong></div>
          </div>
          <SummaryDetails book={book} balanceLabel={period === 'all' ? 'שארית בסוף התקופה' : 'שארית חודש'} />
        </section>

        <div className="fin-bar"><Filters today={today} /></div>

        {!book.canWrite && <div className="fin-bar"><Notice>הפרויקט זמין לצפייה והדפסה בלבד.</Notice></div>}

        <div className="fin-tablewrap">
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
                <tr key={row.id}>
                  <td className="fin-num">{rowDate(row)}</td>
                  <td className="fin-details">{row.details}{row.kind !== 'income' && row.kind !== 'expense' && <span className="fin-kind">{KIND_LABELS[row.kind]}</span>}</td>
                  <td className="fin-num">{isIncomeKind(row.kind) ? rowAmount(row) : ''}</td>
                  <td className="fin-num">{!isIncomeKind(row.kind) ? rowAmount(row) : ''}</td>
                  <td className="no-print">{book.canWrite && (
                    <span className="fin-rowactions">
                      {book.canCancel && <button type="button" className="fin-iconbtn fin-iconbtn--danger" onClick={() => setCancelRow(row)} aria-label={`ביטול תנועה: ${row.details}`}><TrashIcon /></button>}
                      <button type="button" className="fin-iconbtn" onClick={() => setDialog({ row })} aria-label={`עריכת תנועה: ${row.details}`}><PencilIcon /></button>
                    </span>
                  )}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th scope="row" colSpan={2}>סיכום התנועות המוצגות</th><td className="fin-num">{shekels(book.filteredRows.income)}</td><td className="fin-num">{shekels(book.filteredRows.expense)}</td><td className="no-print" /></tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {dialog && (
        <EntrySheet title={dialog.row ? 'עריכת תנועה' : 'תנועה חדשה'} onClose={() => setDialog(null)}>
          <EntryForm projectId={book.projectId} today={today} row={dialog.row} defaultMonth={entryMonth} variant="screen" onDone={() => setDialog(null)} />
        </EntrySheet>
      )}

      {cancelRow && <CancelConfirm projectId={book.projectId} row={cancelRow} onClose={() => setCancelRow(null)} />}

      {period === 'all' && (
        <Card className="fin-main fin-monthsbox">
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
