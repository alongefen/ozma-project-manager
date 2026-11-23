'use client';
import type { TransactionRow } from '@/types/contracts';
import { ConfirmDialog } from '@/components/ui';
import { KIND_LABELS, rowAmount, rowDate } from './present';
import { useTransactions } from './useTransactions';

/** Confirmation before a transaction is cancelled. It stays in the history and stops counting in the sums. */
export function CancelConfirm({ projectId, row, onClose }: { projectId: string; row: TransactionRow; onClose: () => void }) {
  const tx = useTransactions(projectId);
  return (
    <ConfirmDialog open danger title="ביטול תנועה" confirmLabel="כן, לבטל תנועה" busyLabel="מבטל…" busy={tx.busy} error={tx.error}
      onConfirm={async () => { if (await tx.cancel(row)) onClose(); }} onCancel={onClose}>
      <p>לבטל את התנועה הזאת?</p>
      <dl className="fin-confirm__row">
        <div><dt>{KIND_LABELS[row.kind]}</dt><dd className="fin-num">{rowAmount(row)}</dd></div>
        <div><dt>פרטים</dt><dd>{row.details}</dd></div>
        <div><dt>תאריך</dt><dd className="fin-num">{rowDate(row)}</dd></div>
      </dl>
      <p className="fin-confirm__note">התנועה תישמר בהיסטוריה ולא תיספר בסכומים.</p>
    </ConfirmDialog>
  );
}
