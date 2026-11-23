// Navigation model shared by the phone and desktop shells. Pure data and functions, no React.
// Roles: only the owner (Ben) is global. Manager and worker are per-project roles (A-06), so the
// shell only ever branches on `isOwner`.

export type IconName = 'projects' | 'diary' | 'report' | 'finance' | 'more' | 'users' | 'archive' | 'log' | 'account' | 'logout';

export type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: IconName;
  /** The prominent middle button of the phone bottom navigation. */
  prominent?: boolean;
};

// P2.7 (home) replaces this. Until then `/more` is the only real screen after sign-in.
export const HOME_PATH = '/more';
export const SIGN_IN_PATH = '/sign-in';
export const REPORT_PATH = '/diary/new';

const projects: NavItem = { key: 'projects', href: '/projects', label: 'פרויקטים', icon: 'projects' };
const diary: NavItem = { key: 'diary', href: '/diary', label: 'יומן', icon: 'diary' };
const report: NavItem = { key: 'report', href: REPORT_PATH, label: 'דיווח חדש', icon: 'report', prominent: true };
const finance: NavItem = { key: 'finance', href: '/finance', label: 'כספים', icon: 'finance' };
const more: NavItem = { key: 'more', href: '/more', label: 'עוד', icon: 'more' };

/**
 * Phone bottom navigation, in reading order (first item is rightmost in RTL).
 * Always an odd number of items with the report button in the middle (DESIGN 4.1).
 */
export function phoneNav(isOwner: boolean): NavItem[] {
  return isOwner ? [projects, diary, report, finance, more] : [projects, report, diary];
}

/** Desktop sidebar (DESIGN S01): the demo navigation, with the report entry first-class. */
export function desktopNav(isOwner: boolean): NavItem[] {
  const base: NavItem[] = [projects, diary, report];
  return isOwner
    ? [...base, finance, { key: 'users', href: '/users', label: 'עובדים והרשאות', icon: 'users' }]
    : base;
}

/** The "more" screen links, owner only (DESIGN S03). Everyone gets the account block. */
export function moreLinks(isOwner: boolean): NavItem[] {
  if (!isOwner) return [];
  return [
    { key: 'users', href: '/users', label: 'עובדים והרשאות', icon: 'users' },
    { key: 'archive', href: '/projects?archive=1', label: 'ארכיון פרויקטים', icon: 'archive' },
    { key: 'log', href: '/log', label: 'תיעוד פעולות', icon: 'log' },
  ];
}

export function isActive(pathname: string, href: string): boolean {
  const path = href.split('?')[0];
  return pathname === path || pathname.startsWith(path + '/');
}

/** The single best-matching item, so /diary/new highlights the report button and not "diary". */
export function activeItem(pathname: string, items: NavItem[]): NavItem | undefined {
  return items
    .filter(item => isActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

const TITLES: [string, string][] = [
  ['/diary/new', 'דיווח חדש'],
  ['/diary', 'יומן עבודה'],
  ['/projects', 'פרויקטים'],
  ['/finance', 'כספים'],
  ['/users', 'עובדים והרשאות'],
  ['/log', 'תיעוד פעולות'],
  ['/more', 'עוד'],
];

export function screenTitle(pathname: string): string {
  return TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'))?.[1] ?? 'חי עוצמה';
}

/** Breakpoint between the two shells: phone up to 1023, desktop from 1024 (DESIGN 4). */
export const DESKTOP_MIN_WIDTH = 1024;

/** Two initials for the account avatar. */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.length === 1 ? [...parts[0]][0] : [...parts[0]][0] + [...parts[parts.length - 1]][0];
}
