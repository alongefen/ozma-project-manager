'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { FinanceBook, TransactionRow } from '@/types/contracts';
import { Button, Card, DeleteIcon, EditIcon, ExcelIcon, IconButton, Notice, Pin, PrintIcon } from '@/components/ui';
import { EntryForm } from '../shared/EntryForm';
import { ExcelLink } from '../shared/ExcelLink';
import { DesktopFilterBar } from './DesktopFilterBar';
import { EntrySheet } from '../shared/EntrySheet';
import { CancelConfirm } from '../shared/CancelConfirm';
import { SummaryDetails } from '../shared/Summary';
import { useFinanceNav } from '../shared/nav';
import { KIND_LABELS, bookRows, visibleRows, isIncomeKind, monthLabel, monthsNewestFirst, rowAmount, rowDate, shekels } from '../shared/present';
import { allExportHref, currentMonth, exportHref } from '../shared/query';

type Props = { book: FinanceBook; filteredRows: FinanceBook['filteredRows']; today: string };

/** Desktop (from 1024): the demo's content in one panel: summary on top, filters, quick entry, table. */
export function FinanceDesktop({ book, filteredRows, today }: Props) {
  const { filter, totalsReady, all, href, rowProjectId, rowOpen } = useFinanceNav();
  const cols = all ? 6 : 5;
  const [dialog, setDialog] = useState<{ row: TransactionRow | null } | null>(null);
  const [cancelRow, setCancelRow] = useState<TransactionRow | null>(null);
  const rows = visibleRows(bookRows(book.months), filter);
  const period = filter.period;
  const entryMonth = period === 'all' ? currentMonth(today) : period;
  const filtered = filter.day !== undefined || !!filter.search;
  const label = period === 'all' ? 'כל התקופה' : monthLabel(period);

  return (
    <div className="fin fin-desktop d-only">
      <div className="fin-head">
        <div className="fin-head__actions">
          <a className="ui-btn ui-btn--secondary ui-btn--small" href={all ? allExportHref(filter, all.project) : exportHref(book.projectId, filter)}><ExcelIcon size={20} /> ייצוא ל-Excel</a>
          <Button variant="secondary" size="small" onClick={() => window.print()}><PrintIcon size={20} /> הדפסה</Button>
          {!all && <ExcelLink projectId={book.projectId} link={book.excelLink} canWrite={book.canWrite} />}
        </div>
      </div>

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

        <Pin className="fin-bar"><DesktopFilterBar today={today} onAdd={book.canWrite ? () => setDialog({ row: null }) : undefined} /></Pin>

        {!book.canWrite && !all && <div className="fin-bar"><Notice>הפרויקט זמין לצפייה והדפסה בלבד.</Notice></div>}

        <div className="fin-tablewrap">
          <table className="fin-table">
            <caption className="sr-only">תנועות כספיות</caption>
            <thead>
              <tr><th scope="col">תאריך</th>{all && <th scope="col">פרויקט</th>}<th scope="col">פרטים / ספק</th><th scope="col">הכנסה</th><th scope="col">הוצאה</th><th scope="col" className="no-print">פעולות</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={cols} className="fin-empty">
                  {filtered ? 'לא נמצאו תנועות' : 'אין תנועות בתקופה'}
                  {filtered && <> · <Link href={href({ period })}>איפוס סינון</Link></>}
                </td></tr>
              )}
              {rows.map((row: TransactionRow) => (
                <tr key={row.id}>
                  <td className="fin-num">{rowDate(row)}</td>
                  {all && <td className="fin-project">{all.projectOf[row.id]}</td>}
                  <td className="fin-details">{row.details}{row.kind !== 'income' && row.kind !== 'expense' && <span className="fin-kind">{KIND_LABELS[row.kind]}</span>}</td>
                  <td className="fin-num">{isIncomeKind(row.kind) ? rowAmount(row) : ''}</td>
                  <td className="fin-num">{!isIncomeKind(row.kind) ? rowAmount(row) : ''}</td>
                  <td className="no-print">{book.canWrite && rowOpen(row.id) && (
                    <span className="ui-iconrow">
                      {book.canCancel && <IconButton tone="danger" label={`ביטול תנועה: ${row.details}`} onClick={() => setCancelRow(row)}><DeleteIcon /></IconButton>}
                      <IconButton label={`עריכת תנועה: ${row.details}`} onClick={() => setDialog({ row })}><EditIcon /></IconButton>
                    </span>
                  )}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th scope="row" colSpan={all ? 3 : 2}>סיכום התנועות המוצגות</th><td className="fin-num" aria-busy={!totalsReady}>{totalsReady ? shekels(filteredRows.income) : '…'}</td><td className="fin-num">{totalsReady ? shekels(filteredRows.expense) : '…'}</td><td className="no-print" /></tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {dialog && (
        <EntrySheet title={dialog.row ? 'עריכת תנועה' : 'תנועה חדשה'} onClose={() => setDialog(null)}>
          <EntryForm projectId={dialog.row ? rowProjectId(dialog.row.id) : (all ? (all.projects.find(p => p.id === all.project)?.open ? all.project! : '') : book.projectId)} projects={all?.projects} today={today} row={dialog.row} defaultMonth={entryMonth} variant="screen" onDone={() => setDialog(null)} />
        </EntrySheet>
      )}

      {cancelRow && <CancelConfirm projectId={rowProjectId(cancelRow.id)} row={cancelRow} onClose={() => setCancelRow(null)} />}

      {period === 'all' && (
        <Card className="fin-main fin-monthsbox">
          <h2>פירוט חודשים</h2>
          <table className="fin-table fin-months">
            <thead><tr><th scope="col">חודש</th><th scope="col">הכנסות</th><th scope="col">סה״כ הוצאה</th><th scope="col">רווח נקי</th><th scope="col">שארית חודש</th></tr></thead>
            <tbody>
              {monthsNewestFirst(book).map(({ summary: s }) => (
                <tr key={`${s.year}-${s.month}`}>
                  <th scope="row"><Link href={href({ period: { year: s.year, month: s.month } })}>{monthLabel(s)}</Link></th>
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
