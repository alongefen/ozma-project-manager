import type { ReactNode } from 'react';

export function Badge({ tone = 'active', children }: { tone?: 'active' | 'gray'; children: ReactNode }) {
  return <span className={`ui-badge${tone === 'gray' ? ' ui-badge--gray' : ''}`}>{children}</span>;
}
