// Navigation model shared by the phone and desktop shells. Pure data and functions, no React.
// Roles: only the owner (Ben) is global. Manager and worker are per-project roles (A-06), so the
// shell only ever branches on `isOwner`.

export type IconName = 'projects' | 'diary' | 'report' | 'finance' | 'more' | 'users' | 'archive' | 'log' | 'account' | 'logout' | 'leads';

export type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: IconName;
  /** The prominent middle button of the phone bottom navigation. */
  prominent?: boolean;
};

// The home screen is the projects page; the index route `/` redirects to it.
export const HOME_PATH = '/projects';
export const SIGN_IN_PATH = '/sign-in';
export const REPORT_PATH = '/diary/new';

const projects: NavItem = { key: 'projects', href: '/projects', label: 'פרויקטים', icon: 'projects' };
const diary: NavItem = { key: 'diary', href: '/diary', label: 'יומן', icon: 'diary' };
const report: NavItem = { key: 'report', href: REPORT_PATH, label: 'דיווח חדש', icon: 'report', prominent: true };
const finance: NavItem = { key: 'finance', href: '/finance', label: 'כספים', icon: 'finance' };
const leads: NavItem = { key: 'leads', href: '/leads', label: 'לידים', icon: 'leads' };
const more: NavItem = { key: 'more', href: '/more', label: 'עוד', icon: 'more' };

/**
 * Phone bottom navigation, in reading order (first item is rightmost in RTL).
 * Always an odd number of items with the report button in the middle (DESIGN 4.1).
 */
export function phoneNav(isOwner: boolean): NavItem[] {
  return isOwner ? [projects, diary, report, finance, more] : [projects, report, diary];
}

/** Desktop sidebar (DESIGN S01): the demo navigation, with the report entry first-class. */
export function desktopNav(isOwner: boolean, leadsAvailable = false): NavItem[] {
  const base: NavItem[] = [projects, diary, report];
  return isOwner
    ? [...base, finance, ...(leadsAvailable ? [leads] : []), { key: 'users', href: '/users', label: 'עובדים והרשאות', icon: 'users' }]
    : base;
}

/**
 * The "more" screen links, owner only (DESIGN S03). Everyone gets the account block.
 * The archive list and the action log (DESIGN S16) have no screen yet, so they are not linked:
 * a link must never lead to a 404 or to a page that ignores it.
 */
export function moreLinks(isOwner: boolean, leadsAvailable = false): NavItem[] {
  if (!isOwner) return [];
  return [...(leadsAvailable ? [leads] : []), { key: 'users', href: '/users', label: 'עובדים והרשאות', icon: 'users' }];
}

const PROJECT_ROUTE = /^\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;

/**
 * Where the "דיווח חדש" button goes, derived from the CURRENT address only and never remembered: inside a project it is that
 * project's diary with the window open (preset to the project); anywhere else it is the general report flow, no project preset.
 */
export function reportHref(pathname: string): string {
  const id = PROJECT_ROUTE.exec(pathname)?.[1];
  return id ? `/projects/${id}/diary?new=1` : REPORT_PATH;
}

/** The href a nav item links to now: only the report button depends on where the person is. */
export function navHref(item: NavItem, pathname: string): string {
  return item.key === 'report' ? reportHref(pathname) : item.href;
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
  // Reached from the "הדפסה וייצוא לפי תאריך" button on the diary (both views), not from the main navigation.
  ['/reports/diary', 'הדפסת יומן לפי תאריך'],
  ['/diary', 'יומן עבודה'],
  ['/projects', 'פרויקטים'],
  ['/finance', 'כספים'],
  ['/users', 'עובדים והרשאות'],
  ['/more', 'עוד'],
  ['/leads', 'לידים'],
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
