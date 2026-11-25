'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TransactionRow } from '@/types/contracts';
import { Card, DeleteIcon, IconButton } from '@/components/ui';
import { HardDeleteDialog } from '@/features/projects/shared/HardDelete';
import { useFinanceNav } from './nav';
import { KIND_LABELS, rowAmount, rowDate } from './present';

/**
 * Cancelled transactions of the shown period (owner, all-projects page). They count in no total. Each has "מחיקה
 * סופית" (A-44): the shared confirmation window, owner and cancelled rows only; the server refuses anything else.
 */
export function CancelledRows() {
  const { all } = useFinanceNav();
  const router = useRouter();
  const [target, setTarget] = useState<TransactionRow | null>(null);
  if (!all || all.cancelled.length === 0) return null;
  return (
    <section className="fin no-print" aria-label="תנועות מבוטלות">
      <Card>
        <details className="fin-cancelled">
          <summary><h2>תנועות מבוטלות ({all.cancelled.length})</h2></summary>
          <ul className="fin-list">
            {all.cancelled.map(row => (
              <li key={row.id} className="fin-item">
                <span className="fin-item__top"><span className="fin-item__kind">{KIND_LABELS[row.kind]} · מבוטלת</span><strong className="fin-num">{rowAmount(row)}</strong></span>
                <span className="fin-item__details">{row.details}</span>
                <span className="fin-item__project">{all.projectOf[row.id]}</span>
                <span className="fin-item__bottom">
                  <span className="fin-item__sub fin-num">{rowDate(row)}</span>
                  <span className="ui-iconrow"><IconButton tone="danger" label={`מחיקה סופית: ${row.details}`} onClick={() => setTarget(row)}><DeleteIcon /></IconButton></span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      </Card>
      {target && <HardDeleteDialog kind="transaction" id={target.id} open onClose={() => setTarget(null)} onDone={() => { setTarget(null); router.refresh(); }} />}
    </section>
  );
}
