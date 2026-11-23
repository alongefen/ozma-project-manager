import Link from 'next/link';
import css from './BackTitle.module.css';

/** Screen title with a large arrow-only back link at its start (RTL: on the right, before the title), the same placement on every project screen. */
export function BackTitle({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  return (
    <div className={css.row}>
      <Link href={backHref} className={css.back} aria-label={backLabel}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Link>
      <h1 className={css.title}>{title}</h1>
    </div>
  );
}
