import type { TransferMonth } from '@/types/contracts';
import { Card } from '@/components/ui';
import { NO_TRANSFERS, transferViews } from '../shared/view-model';
import css from '../shared/Overview.module.css';
import m from './Mobile.module.css';

/** Phone transfer screen: one card per month with the amount to transfer; the breakdown per project opens under it. */
export function TransferMobile({ months, embedded = false }: { months: TransferMonth[]; embedded?: boolean }) {
  const views = transferViews(months);
  return (
    <div className={`${m.page} m-only${embedded ? ' fin no-print' : ''}`}>
      {embedded && <h2>העברות מס לפי חודש</h2>}
      {views.length === 0 && <Card><p className={css.empty}>{NO_TRANSFERS}</p></Card>}
      {views.map((v, i) => (
        <Card key={v.key} className={m.month}>
          <details open={i === 0}>
            <summary className={m.summary}>
              <span className={m.monthName}>{v.label}</span>
              <span className={m.amountBox}><small>סכום העברה</small><strong className={css.num}>{v.amount}</strong></span>
            </summary>
            <ul className={m.lines}>
              {v.lines.map(l => (
                <li key={l.projectId} className={m.line}>
                  <strong>{l.name}</strong>
                  <dl className={css.cubeRows}>
                    <div><dt>הכנסות (לא כולל מע״מ)</dt><dd className={css.num}>{l.income}</dd></div>
                    <div><dt>הוצאות</dt><dd className={css.num}>{l.expense}</dd></div>
                    <div><dt>מס להעברה</dt><dd className={css.num}>{l.tax}</dd></div>
                    <div><dt>רווח נקי</dt><dd className={css.num}>{l.net}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ))}
    </div>
  );
}
