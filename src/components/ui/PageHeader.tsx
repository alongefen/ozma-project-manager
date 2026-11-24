import Link from 'next/link';
import type { ReactNode } from 'react';
import { PinHead } from './PinHead';

/**
 * The one header of every inner page (DESIGN 3.5), phone and desktop: an arrow-only back link on the right,
 * the title, an optional badge, and actions at the far left. The shell header is hidden on inner routes,
 * so this is the only title on the screen. One height, so the header never jumps between pages.
 * It is pinned to the top while the page scrolls (with `children`, such as the project tabs, under it).
 */
export function PageHeader({ title, backHref, backLabel, badge, actions, sub, children }: {
  title: ReactNode; backHref: string; backLabel: string; badge?: ReactNode; actions?: ReactNode; sub?: ReactNode; /** Pinned under the title row (the project tabs). */ children?: ReactNode;
}) {
  return (
    <PinHead>
    <div className="ui-ph">
      <div className="ui-ph__row">
        <Link href={backHref} className="ui-ph__back" aria-label={backLabel}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
        <h1 className="ui-ph__title">{title}</h1>
        {badge}
        {actions && <div className="ui-ph__actions">{actions}</div>}
      </div>
      {sub && <p className="ui-sub ui-ph__sub">{sub}</p>}
    </div>
    {children}
    </PinHead>
  );
}
