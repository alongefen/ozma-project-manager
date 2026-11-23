import type { ReactNode } from 'react';

/** Info notices are polite; errors are announced immediately. State is carried by text, not colour alone. */
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error'; children: ReactNode }) {
  return (
    <div className={`ui-notice${tone === 'error' ? ' ui-notice--error' : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
