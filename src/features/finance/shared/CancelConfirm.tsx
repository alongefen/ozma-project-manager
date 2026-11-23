'use client';
import type { TransactionRow } from '@/types/contracts';
import { Button, Notice } from '@/components/ui';
import { EntrySheet } from './EntrySheet';
import { KIND_LABELS, rowAmount, rowDate } from './present';
import { useTransactions } from './useTransactions';

/** Confirmation before a transaction is cancelled. It stays in the history and stops counting in the sums. */
export function CancelConfirm({ projectId, row, onClose }: { projectId: string; row: TransactionRow; onClose: () => void }) {
  const tx = useTransactions(projectId);
  return (
    <EntrySheet title="ביטול תנועה" onClose={onClose}>
      <div className="fin-confirm">
        <p>לבטל את התנועה הזאת?</p>
        <dl className="fin-confirm__row">
          <div><dt>{KIND_LABELS[row.kind]}</dt><dd className="fin-num">{rowAmount(row)}</dd></div>
          <div><dt>פרטים</dt><dd>{row.details}</dd></div>
          <div><dt>תאריך</dt><dd className="fin-num">{rowDate(row)}</dd></div>
        </dl>
        <p className="fin-confirm__note">התנועה תישמר בהיסטוריה ולא תיספר בסכומים.</p>
        {tx.error && <Notice tone="error">{tx.error}</Notice>}
        <div className="fin-entry__actions">
          <Button className="fin-danger" disabled={tx.busy} onClick={async () => { if (await tx.cancel(row)) onClose(); }}>{tx.busy ? 'מבטל…' : 'כן, לבטל תנועה'}</Button>
          <Button variant="secondary" onClick={onClose} disabled={tx.busy}>חזרה</Button>
        </div>
      </div>
    </EntrySheet>
  );
}
