import type { IconName } from '@/lib/navigation';

const PATHS: Record<IconName, string> = {
  projects: 'M3 21V9l9-6 9 6v12M9 21v-6h6v6',
  diary: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 8h6M9 12h6M9 16h4',
  report: 'M12 5v14M5 12h14',
  finance: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  users: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8',
  archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  log: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  account: 'M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
};

/** Decorative icon: the visible label next to it carries the accessible name. */
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg className={`ui-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
