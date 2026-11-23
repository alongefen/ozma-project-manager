import type { ReactNode } from 'react';

/** Vertical stack of an inner page: header, then sections with one gap. `narrow` caps forms and lists on desktop. */
export function Page({ narrow, children }: { narrow?: boolean; children: ReactNode }) {
  return <div className={`ui-page${narrow ? ' ui-page--narrow' : ''}`}>{children}</div>;
}
