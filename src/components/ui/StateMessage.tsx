import Link from 'next/link';
import { Notice } from './Notice';

/** Empty, forbidden or error state of a whole page: one message and one way back. Never shows data. */
export function StateMessage({ tone = 'info', children, backHref, backLabel }: { tone?: 'info' | 'error'; children: string; backHref: string; backLabel: string }) {
  return (
    <div className="ui-page ui-page--narrow">
      <Notice tone={tone}>{children}</Notice>
      <Link href={backHref} className="ui-btn ui-btn--secondary ui-btn--block">{backLabel}</Link>
    </div>
  );
}
