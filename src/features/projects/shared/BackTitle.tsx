import Link from 'next/link';
import type { ReactNode } from 'react';
import css from './BackTitle.module.css';

/**
 * Project screen header (DESIGN 3.5): an arrow-only back link on the right, then the title, an optional
 * badge next to it, and optional actions at the far left. One component and one height for every
 * project screen, so the header does not jump between pages.
 */
export function BackTitle({ title, backHref, backLabel, badge, actions }: { title: string; backHref: string; backLabel: string; badge?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={css.row}>
      <Link href={backHref} className={css.back} aria-label={backLabel}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Link>
      <h1 className={css.title}>{title}</h1>
      {badge}
      {actions && <div className={css.actions}>{actions}</div>}
    </div>
  );
}
