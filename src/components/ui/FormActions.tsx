import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from './Button';
import css from './FormActions.module.css';

/**
 * Save bar of a form: primary action first, cancel second. On a full page it sits above the bottom navigation
 * on the phone and under the form on desktop; inside a sheet it sticks to the bottom of the sheet.
 */
export function FormActions({ submitLabel, busy, cancelHref, onCancel, placement = 'page', extra, form, hideCancel = false, spread = false }: {
  submitLabel: string; busy?: boolean; cancelHref?: string; onCancel?: () => void; placement?: 'page' | 'sheet'; extra?: ReactNode; form?: string; hideCancel?: boolean; /** Keep submit right and extra actions left in one row. */ spread?: boolean;
}) {
  return (
    <div className={`ui-actions ui-actions--${placement}${spread ? ` ${css.spread}` : ''}`}>
      <Button type="submit" form={form} disabled={busy}>{submitLabel}</Button>
      {!hideCancel && (cancelHref ? <Link href={cancelHref} className="ui-btn ui-btn--secondary">ביטול</Link> : <Button variant="secondary" onClick={onCancel}>ביטול</Button>)}
      {spread && extra ? <div className={css.extra}>{extra}</div> : extra}
    </div>
  );
}
