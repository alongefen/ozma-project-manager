'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { FinanceBook, ProjectDetails, TransactionRow } from '@/types/contracts';
import { Button, Card, Notice } from '@/components/ui';
import { ProjectTabs } from '@/features/projects/shared/ProjectTabs';
import { sectionsFor } from '@/features/projects/shared/view-model';
import { Chevron } from '../shared/Chevron';
import { EntryForm } from '../shared/EntryForm';
import { ExcelLink } from '../shared/ExcelLink';
import { Filters } from '../shared/Filters';
import { SummaryDetails } from '../shared/Summary';
import { useFinanceNav } from '../shared/nav';
import { KIND_LABELS, bookRows, isReduction, monthLabel, monthsNewestFirst, rowAmount, rowDate, shekels } from '../shared/present';
import { currentMonth, exportHref, financeHref } from '../shared/query';
import { EntrySheet } from '../shared/EntrySheet';
import { CancelConfirm } from '../shared/CancelConfirm';
import { ExcelIcon, PencilIcon, TrashIcon } from '../shared/FinIcons';

type Props = { book: FinanceBook; today: string };

const step = (m: { year: number; month: number }, delta: number) => {
  const index = m.year * 12 + (m.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

/** Phone (up to 1023): back arrow, period switch, one summary, a grouped list, an entry sheet. No table, no tab bar. */
export function FinanceMobile({ book, today }: Props) {
  const { filter, go } = useFinanceNav();
  const [sheet, setSheet] = useState<{ row: TransactionRow | null } | null>(null);
  const [cancelRow, setCancelRow] = useState<TransactionRow | null>(null);
  const [panel, setPanel] = useState<'filter' | null>(null);
  const period = filter.period;
  const entryMonth = period === 'all' ? currentMonth(today) : period;
  const rows = bookRows(book.months);
  const filtered = filter.day !== undefined || !!filter.search;
  const toggle = (p: 'filter') => setPanel(v => (v === p ? null : p));

  return (
    <div className="fin fin-mobile m-only">
      <div className="fin-mtop">
        <Link href="/projects" className="fin-back" aria-label="חזרה לרשימת הפרויקטים"><Chevron side="right" /></Link>
        <h1 className="fin-mtitle">{book.projectName}</h1>
      </div>

      <ProjectTabs projectId={book.projectId} sections={sectionsFor({ id: book.projectId, permissions: { viewFinance: true } as ProjectDetails['permissions'] })} current="finance" />

      <div className="fin-seg" role="group" aria-label="תקופה">
        <button type="button" aria-pressed={period !== 'all'} onClick={() => go({ ...filter, period: period === 'all' ? currentMonth(today) : period })}>חודש</button>
        <button type="button" aria-pressed={period === 'all'} onClick={() => go({ ...filter, period: 'all' })}>כל התקופה</button>
      </div>
      {period !== 'all' && (
        <div className="fin-monthpicker" role="group" aria-label="בחירת חודש">
          <button type="button" className="fin-step" aria-label="חודש קודם" onClick={() => go({ ...filter, period: step(period, -1) })}><Chevron side="right" /></button>
          <strong aria-live="polite">{monthLabel(period)}</strong>
          <button type="button" className="fin-step" aria-label="חודש הבא" onClick={() => go({ ...filter, period: step(period, 1) })}><Chevron side="left" /></button>
        </div>
      )}

      <Card className="fin-msum">
        <div className="fin-msum__head">
          <h2>{period === 'all' ? 'כל התקופה' : monthLabel(period)}</h2>
          <a className="fin-export no-print" href={exportHref(book.projectId, filter)}><span>ייצוא ל-Excel</span><ExcelIcon /></a>
        </div>
        <div className="fin-msum__row"><span>הכנסות</span><strong className="fin-num">{shekels(book.period.income)}</strong></div>
        <div className="fin-msum__row"><span>סה״כ הוצאה כולל מס 3%</span><strong className="fin-num">{shekels(book.period.totalExpense)}</strong></div>
        <div className="fin-msum__row fin-msum__row--net"><span>רווח נקי</span><strong className="fin-num">{shekels(book.period.netProfit)}</strong></div>
        <SummaryDetails book={book} balanceLabel={period === 'all' ? 'שארית בסוף התקופה' : 'שארית חודש'} />
      </Card>

      <div className="fin-mactions no-print">
        {book.canWrite && <Button block onClick={() => setSheet({ row: null })}>הוספת תנועה</Button>}
        <Button variant="secondary" block aria-expanded={panel === 'filter'} onClick={() => toggle('filter')}>סינון</Button>
      </div>
      {!book.canWrite && <Notice>הפרויקט זמין לצפייה והדפסה בלבד.</Notice>}
      {panel === 'filter' && <Card><Filters today={today} showMonth={false} /></Card>}
      {period === 'all' ? (
        <ul className="fin-list" aria-label="חודשים">
          {monthsNewestFirst(book).map(({ summary: s }) => (
            <li key={`${s.year}-${s.month}`}>
              <Link className="fin-item" href={financeHref(book.projectId, { period: { year: s.year, month: s.month } })}>
                <span className="fin-item__top"><strong>{monthLabel(s)}</strong><span className="fin-num">רווח נקי {shekels(s.netProfit)}</span></span>
                <span className="fin-item__sub">הכנסות <span className="fin-num">{shekels(s.income)}</span> · הוצאה <span className="fin-num">{shekels(s.totalExpense)}</span></span>
              </Link>
            </li>
          ))}
          {book.months.length === 0 && <li className="fin-empty">אין תנועות בפרויקט</li>}
        </ul>
      ) : (
        <>
          <ul className="fin-list" aria-label="תנועות">
            {rows.map(row => (
              <li key={row.id} className="fin-item">
                <span className="fin-item__top">
                  <span className="fin-item__kind">{KIND_LABELS[row.kind]}</span>
                  <strong className={`fin-num${isReduction(row.kind) ? ' fin-neg' : ''}`}>{rowAmount(row)}</strong>
                </span>
                <span className="fin-item__details">{row.details}</span>
                <span className="fin-item__bottom">
                  <span className="fin-item__sub fin-num">{rowDate(row)}</span>
                  {book.canWrite && (
                    <span className="fin-rowactions no-print">
                      {book.canCancel && <button type="button" className="fin-iconbtn fin-iconbtn--danger" onClick={() => setCancelRow(row)} aria-label={`ביטול תנועה: ${row.details}`}><TrashIcon /></button>}
                      <button type="button" className="fin-iconbtn" onClick={() => setSheet({ row })} aria-label={`עריכת תנועה: ${row.details}`}><PencilIcon /></button>
                    </span>
                  )}
                </span>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="fin-empty">
                {filtered ? 'לא נמצאו תנועות' : 'אין תנועות בחודש הזה'}
                {filtered && <> · <Link href={financeHref(book.projectId, { period })}>איפוס סינון</Link></>}
              </li>
            )}
          </ul>
          {filtered && (
            <p className="fin-filteredsum">סיכום התנועות המוצגות: הכנסה <b className="fin-num">{shekels(book.filteredRows.income)}</b> · הוצאה <b className="fin-num">{shekels(book.filteredRows.expense)}</b></p>
          )}
        </>
      )}

      <div className="fin-footlinks no-print">
        <ExcelLink projectId={book.projectId} link={book.excelLink} canWrite={book.canWrite} />
        <Button variant="secondary" size="small" onClick={() => window.print()}>הדפסה</Button>
      </div>

      {cancelRow && <CancelConfirm projectId={book.projectId} row={cancelRow} onClose={() => setCancelRow(null)} />}

      {sheet && (
        <EntrySheet title={sheet.row ? 'עריכת תנועה' : 'תנועה חדשה'} onClose={() => setSheet(null)}>
          <EntryForm projectId={book.projectId} today={today} row={sheet.row} defaultMonth={entryMonth} variant="screen" onDone={() => setSheet(null)} />
        </EntrySheet>
      )}
    </div>
  );
}
