import type { TransferMonth } from '@/types/contracts';
import { Card } from '@/components/ui';
import { DesktopTitle } from '../shared/Parts';
import { NO_TRANSFERS, transferViews } from '../shared/view-model';
import css from '../shared/Overview.module.css';
import d from './Desktop.module.css';

/** Desktop transfer overview: one table, months newest first, each month's amount then its projects. */
export function TransferDesktop({ months, embedded = false }: { months: TransferMonth[]; embedded?: boolean }) {
  const views = transferViews(months);
  return (
    <div className={`${d.page} d-only${embedded ? ' fin no-print' : ''}`}>
      {embedded ? <h2>העברות מס לפי חודש</h2> : <DesktopTitle title="כספים" />}
      {views.length === 0 ? <Card panel><p className={css.empty}>{NO_TRANSFERS}</p></Card> : (
        <Card panel className={d.tableCard}>
          <table className={d.table}>
            <thead>
              <tr><th scope="col">חודש / פרויקט</th><th scope="col">הכנסות</th><th scope="col">הוצאות</th><th scope="col">מס להעברה</th><th scope="col">רווח נקי</th></tr>
            </thead>
            {views.map(v => (
              <tbody key={v.key}>
                <tr className={d.monthRow}>
                  <th scope="rowgroup">{v.label}</th><td colSpan={2} />
                  <td className={css.num}><strong>{v.amount}</strong></td><td />
                </tr>
                {v.lines.map(l => (
                  <tr key={l.projectId}>
                    <th scope="row" className={d.projectCell}>{l.name}</th>
                    <td className={css.num}>{l.income}</td><td className={css.num}>{l.expense}</td>
                    <td className={css.num}>{l.tax}</td><td className={css.num}>{l.net}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </Card>
      )}
    </div>
  );
}
