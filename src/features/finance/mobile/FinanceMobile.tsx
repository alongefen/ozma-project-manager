'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FinanceBook, FinanceFilter, TransactionRow } from '@/types/contracts';
import { Button, Card, Notice } from '@/components/ui';
import { EntryForm } from '../shared/EntryForm';
import { ExcelLink } from '../shared/ExcelLink';
import { Filters } from '../shared/Filters';
import { SummaryLines, WorkDays } from '../shared/Summary';
import { KIND_LABELS, bookRows, monthLabel, monthsNewestFirst, rowAmount, rowDate, shekels, isReduction } from '../shared/present';
import { currentMonth, exportHref, financeHref } from '../shared/query';

type Props = { book: FinanceBook; filter: FinanceFilter; today: string };

const step = (m: { year: number; month: number }, delta: number) => {
  const index = m.year * 12 + (m.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

/** Phone (up to 1023): month picker, vertical rows, a full-screen entry screen. No table, no tab bar. */
export function FinanceMobile({ book, filter, today }: Props) {
  const router = useRouter();
  const [screen, setScreen] = useState<{ kind: 'list' } | { kind: 'entry'; row: TransactionRow | null }>({ kind: 'list' });
  const [showFilter, setShowFilter] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const period = filter.period;
  const entryMonth = period === 'all' ? currentMonth(today) : period;
  const rows = bookRows(book.months);
  const filtered = filter.day !== undefined || !!filter.search;
  const go = (f: FinanceFilter) => router.push(financeHref(book.projectId, f));

  if (screen.kind === 'entry') {
    const row = screen.row;
    return (
      <div className="fin fin-mobile m-only fin-entryscreen" role="dialog" aria-modal="true" aria-label={row ? 'עריכת תנועה' : 'הוספת תנועה'}>
        <header className="fin-entryscreen__bar">
          <Button variant="secondary" size="small" onClick={() => setScreen({ kind: 'list' })}>חזרה</Button>
          <h1>{row ? 'עריכת תנועה' : 'תנועה חדשה'}</h1>
        </header>
        <div className="fin-entryscreen__body">
          <EntryForm projectId={book.projectId} today={today} row={row} defaultMonth={entryMonth} variant="screen" canCancel={book.canCancel} onDone={() => setScreen({ kind: 'list' })} />
        </div>
      </div>
    );
  }

  return (
    <div className="fin fin-mobile m-only">
      <div className="fin-mhead">
        <h1 className="fin-mtitle">{book.projectName}</h1>
        <div className="fin-monthpicker" role="group" aria-label="בחירת חודש">
          {period === 'all' ? (
            <Button variant="secondary" size="small" onClick={() => go({ ...filter, period: currentMonth(today) })}>לחודש הנוכחי</Button>
          ) : (
            <>
              <button type="button" className="fin-step" aria-label="חודש קודם" onClick={() => go({ ...filter, period: step(period, -1) })}>›</button>
              <strong aria-live="polite">{monthLabel(period)}</strong>
              <button type="button" className="fin-step" aria-label="חודש הבא" onClick={() => go({ ...filter, period: step(period, 1) })}>‹</button>
            </>
          )}
        </div>
        <Button variant={period === 'all' ? 'primary' : 'secondary'} size="small" aria-pressed={period === 'all'} onClick={() => go({ ...filter, period: period === 'all' ? currentMonth(today) : 'all' })}>
          כל התקופה
        </Button>
      </div>

      <Card className="fin-bigsums">
        <div><span>הכנסות</span><strong className="fin-num">{shekels(book.period.income)}</strong></div>
        <div><span>סה״כ הוצאה כולל מס 3%</span><strong className="fin-num">{shekels(book.period.totalExpense)}</strong></div>
        <div><span>רווח נקי</span><strong className="fin-num">{shekels(book.period.netProfit)}</strong></div>
      </Card>

      <div className="fin-mactions no-print">
        {book.canWrite && <Button block onClick={() => setScreen({ kind: 'entry', row: null })}>הוספת תנועה</Button>}
        <Button variant="secondary" block aria-expanded={showFilter} onClick={() => setShowFilter(v => !v)}>סינון</Button>
        <Button variant="secondary" block aria-expanded={showActions} onClick={() => setShowActions(v => !v)}>ייצוא וקישור</Button>
      </div>
      {!book.canWrite && <Notice>הפרויקט זמין לצפייה והדפסה בלבד.</Notice>}
      {showFilter && <Card><Filters projectId={book.projectId} filter={filter} today={today} showMonth={false} /></Card>}
      {showActions && (
        <Card className="fin-actionlist">
          <a className="ui-btn ui-btn--secondary ui-btn--block" href={exportHref(book.projectId, filter)}>ייצוא ל-Excel</a>
          <Button variant="secondary" block onClick={() => window.print()}>הדפסה</Button>
          <ExcelLink projectId={book.projectId} link={book.excelLink} canWrite={book.canWrite} />
        </Card>
      )}

      {period === 'all' ? (
        <ul className="fin-monthcards" aria-label="חודשים">
          {monthsNewestFirst(book).map(({ summary: s }) => (
            <li key={`${s.year}-${s.month}`}>
              <Link className="fin-monthcard" href={financeHref(book.projectId, { period: { year: s.year, month: s.month } })}>
                <strong>{monthLabel(s)}</strong>
                <span>הכנסות <b className="fin-num">{shekels(s.income)}</b></span>
                <span>סה״כ הוצאה <b className="fin-num">{shekels(s.totalExpense)}</b></span>
                <span>שארית חודש <b className="fin-num">{shekels(s.balance)}</b></span>
              </Link>
            </li>
          ))}
          {book.months.length === 0 && <li className="fin-empty">אין תנועות בפרויקט</li>}
        </ul>
      ) : (
        <>
          <ul className="fin-rows" aria-label="תנועות">
            {rows.map(row => (
              <li key={row.id}>
                <button type="button" className="fin-rowbtn" disabled={!book.canWrite} onClick={() => setScreen({ kind: 'entry', row })}>
                  <span className="fin-rowbtn__top">
                    <span className="fin-kind">{KIND_LABELS[row.kind]}</span>
                    <strong className={`fin-num${isReduction(row.kind) ? ' fin-neg' : ''}`}>{rowAmount(row)}</strong>
                  </span>
                  <span className="fin-rowbtn__details">{row.details}</span>
                  <span className="fin-rowbtn__date fin-num">{rowDate(row)}</span>
                </button>
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
            <Card className="fin-filteredsum">
              <span>סיכום התנועות המוצגות</span>
              <span>הכנסה <b className="fin-num">{shekels(book.filteredRows.income)}</b></span>
              <span>הוצאה <b className="fin-num">{shekels(book.filteredRows.expense)}</b></span>
            </Card>
          )}
        </>
      )}

      <Card>
        <h2 className="fin-h2">{period === 'all' ? 'סיכום כל התקופה' : 'סיכום החודש'}</h2>
        <SummaryLines summary={book.period} balance={book.period.balance} previousLabel={period === 'all' ? 'שארית בסוף התקופה' : 'שארית חודש'} />
        <WorkDays book={book} />
      </Card>
    </div>
  );
}
