'use client';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { Notice } from './Notice';
import { Sheet } from './Sheet';

/**
 * Confirmation before anything consequential. Bottom sheet on the phone, centred window on desktop.
 * The destructive choice is the red primary button; "back" is secondary. Nothing is permanent here (A-12).
 */
export function ConfirmDialog({ open, title, confirmLabel, busyLabel, busy, error, danger, onConfirm, onCancel, children }: {
  open: boolean; title: string; confirmLabel: string; busyLabel?: string; busy?: boolean; error?: string | null; danger?: boolean;
  onConfirm: () => void; onCancel: () => void; children: ReactNode;
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <div className="ui-confirm">
        {children}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="ui-actions ui-actions--sheet">
          <Button variant={danger ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>{busy ? (busyLabel ?? 'מבצע…') : confirmLabel}</Button>
          <Button variant="secondary" disabled={busy} onClick={onCancel}>חזרה</Button>
        </div>
      </div>
    </Sheet>
  );
}
