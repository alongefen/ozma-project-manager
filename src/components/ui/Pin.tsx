import type { ReactNode } from 'react';

/**
 * A screen's primary action row (add, upload, filter, print). Stays pinned under the page header (and the project
 * tabs) while the content scrolls, so nobody has to scroll back up to act. Wrap the buttons; never write
 * `position: sticky` in a screen.
 */
export function Pin({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`ui-pin${className ? ` ${className}` : ''}`}>{children}</div>;
}
