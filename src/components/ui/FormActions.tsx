import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from './Button';

/**
 * Save bar of a form: primary action first, cancel second. On a full page it sits above the bottom navigation
 * on the phone and under the form on desktop; inside a sheet it sticks to the bottom of the sheet.
 */
export function FormActions({ submitLabel, busy, cancelHref, onCancel, placement = 'page', extra }: {
  submitLabel: string; busy?: boolean; cancelHref?: string; onCancel?: () => void; placement?: 'page' | 'sheet'; extra?: ReactNode;
}) {
  return (
    <div className={`ui-actions ui-actions--${placement}`}>
      <Button type="submit" disabled={busy}>{submitLabel}</Button>
      {cancelHref ? <Link href={cancelHref} className="ui-btn ui-btn--secondary">ביטול</Link> : <Button variant="secondary" onClick={onCancel}>ביטול</Button>}
      {extra}
    </div>
  );
}
