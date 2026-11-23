import type { HTMLAttributes } from 'react';

export function Card({ panel, className = '', ...rest }: HTMLAttributes<HTMLDivElement> & { panel?: boolean }) {
  return <div className={`ui-card${panel ? ' ui-card--panel' : ''} ${className}`} {...rest} />;
}
