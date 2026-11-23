'use client';
import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { slideFrom, tabIndex } from './tab-motion';
import css from './TabSlide.module.css';

/**
 * The area under the project tabs. Moving between tabs slides the new content in from the side of its tab,
 * while the frame above (back, name, status, permissions, tabs) stays where it is.
 */
export function TabSlide({ hrefs, children }: { hrefs: string[]; children: ReactNode }) {
  const pathname = usePathname();
  const index = tabIndex(pathname, hrefs);
  const [seen, setSeen] = useState({ index, from: null as 'left' | 'right' | null });
  if (seen.index !== index) setSeen({ index, from: slideFrom(seen.index, index) });
  const from = seen.index === index ? seen.from : slideFrom(seen.index, index);
  return (
    <div className={css.clip}>
      <div key={pathname} className={from === 'left' ? css.fromLeft : from === 'right' ? css.fromRight : undefined}>{children}</div>
    </div>
  );
}
