'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { FinanceBook, TransactionRow } from '@/types/contracts';
import { Button, Card, DeleteIcon, EditIcon, ExcelIcon, FilterIcon, IconButton, LinkIcon, Notice, Pin, PrintIcon } from '@/components/ui';
import { Chevron } from '../shared/Chevron';
import { EntryForm } from '../shared/EntryForm';
import { ExcelLink } from '../shared/ExcelLink';
import { Filters } from '../shared/Filters';
import { SummaryDetails } from '../shared/Summary';
import { useFinanceNav } from '../shared/nav';
import { KIND_LABELS, bookRows, visibleRows, isReduction, monthLabel, monthsNewestFirst, rowAmount, rowDate, shekels } from '../shared/present';
import { allExportHref, currentMonth, exportHref } from '../shared/query';
import { EntrySheet } from '../shared/EntrySheet';
import { CancelConfirm } from '../shared/CancelConfirm';

type Props = { book: FinanceBook; filteredRows: FinanceBook['filteredRows']; today: string };

const step = (m: { year: number; month: number }, delta: number) => {
  const index = m.year * 12 + (m.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

/** Phone (up to 1023): back arrow, period switch, one summary, a grouped list, an entry sheet. No table, no tab bar. */
export function FinanceMobile({ book, filteredRows, today }: Props) {
  const { filter, go, totalsReady, all, href } = useFinanceNav();
  const [sheet, setSheet] = useState<{ row: TransactionRow | null } | null>(null);
  const [cancelRow, setCancelRow] = useState<TransactionRow | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [panel, setPanel] = useState<'link' | null>(null);
  const period = filter.period;
  const entryMonth = period === 'all' ? currentMonth(today) : period;
  const rows = visibleRows(bookRows(book.months), filter);
  const filtered = filter.day !== undefined || !!filter.search;
  const toggle = (p: 'link') => setPanel(v => (v === p ? null : p));

  return (
    <div className="fin fin-mobile m-only">
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
          <div className="fin-msum__icons no-print">
            <IconButton plain label="ייצוא ל-Excel" href={all ? allExportHref(filter, all.project) : exportHref(book.projectId, filter)}><ExcelIcon /></IconButton>
            <IconButton plain label="הדפסה" onClick={() => window.print()}><PrintIcon /></IconButton>
            {!all && <IconButton plain label="קישור לקובץ Excel" aria-expanded={panel === 'link'} onClick={() => toggle('link')}><LinkIcon /></IconButton>}
          </div>
        </div>
        <div className="fin-msum__row"><span>הכנסות</span><strong className="fin-num">{shekels(book.period.income)}</strong></div>
        <div className="fin-msum__row"><span>סה״כ הוצאה כולל מס 3%</span><strong className="fin-num">{shekels(book.period.totalExpense)}</strong></div>
        <div className="fin-msum__row fin-msum__row--net"><span>רווח נקי</span><strong className="fin-num">{shekels(book.period.netProfit)}</strong></div>
        <SummaryDetails book={book} balanceLabel={period === 'all' ? 'שארית בסוף התקופה' : 'שארית חודש'} />
      </Card>

      <Pin className="fin-mactions no-print">
        {book.canWrite && <Button block icon="add" onClick={() => setSheet({ row: null })}>הוספת תנועה</Button>}
        <Button variant="secondary" block onClick={() => setFilterOpen(true)}><FilterIcon /> סינון{filtered && <span className="fin-count">{(filter.day !== undefined ? 1 : 0) + (filter.search ? 1 : 0)}</span>}</Button>
      </Pin>
      {!book.canWrite && !all && <Notice>הפרויקט זמין לצפייה והדפסה בלבד.</Notice>}
      {panel === 'link' && <Card><ExcelLink projectId={book.projectId} link={book.excelLink} canWrite={book.canWrite} /></Card>}
      {filtered && (
        <div className="fin-chips" aria-label="סינון פעיל">
          {filter.day !== undefined && <span className="fin-chip">יום {filter.day}<button type="button" aria-label="הסרת סינון יום" onClick={() => go({ ...filter, day: undefined })}>×</button></span>}
          {filter.search && <span className="fin-chip">{filter.search}<button type="button" aria-label="הסרת חיפוש" onClick={() => go({ ...filter, search: undefined })}>×</button></span>}
          <button type="button" className="fin-chips__clear" onClick={() => go({ period: filter.period })}>איפוס הכול</button>
        </div>
      )}
      {period === 'all' ? (
        <ul className="fin-list" aria-label="חודשים">
          {monthsNewestFirst(book).map(({ summary: s }) => (
            <li key={`${s.year}-${s.month}`}>
              <Link className="fin-item" href={href({ period: { year: s.year, month: s.month } })}>
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
                {all && <span className="fin-item__project">{all.projectOf[row.id]}</span>}
                <span className="fin-item__bottom">
                  <span className="fin-item__sub fin-num">{rowDate(row)}</span>
                  {book.canWrite && (
                    <span className="ui-iconrow no-print">
                      {book.canCancel && <IconButton tone="danger" label={`ביטול תנועה: ${row.details}`} onClick={() => setCancelRow(row)}><DeleteIcon /></IconButton>}
                      <IconButton label={`עריכת תנועה: ${row.details}`} onClick={() => setSheet({ row })}><EditIcon /></IconButton>
                    </span>
                  )}
                </span>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="fin-empty">
                {filtered ? 'לא נמצאו תנועות' : 'אין תנועות בחודש הזה'}
                {filtered && <> · <Link href={href({ period })}>איפוס סינון</Link></>}
              </li>
            )}
          </ul>
          {filtered && (
            <p className="fin-filteredsum">סיכום התנועות המוצגות: הכנסה <b className="fin-num">{totalsReady ? shekels(filteredRows.income) : '…'}</b> · הוצאה <b className="fin-num">{totalsReady ? shekels(filteredRows.expense) : '…'}</b></p>
          )}
        </>
      )}

      {cancelRow && <CancelConfirm projectId={book.projectId} row={cancelRow} onClose={() => setCancelRow(null)} />}

      {filterOpen && (
        <EntrySheet title="סינון תנועות" onClose={() => setFilterOpen(false)}>
          <Filters today={today} showMonth={false} onDone={() => setFilterOpen(false)} />
        </EntrySheet>
      )}

      {sheet && (
        <EntrySheet title={sheet.row ? 'עריכת תנועה' : 'תנועה חדשה'} onClose={() => setSheet(null)}>
          <EntryForm projectId={book.projectId} today={today} row={sheet.row} defaultMonth={entryMonth} variant="screen" onDone={() => setSheet(null)} />
        </EntrySheet>
      )}
    </div>
  );
}
