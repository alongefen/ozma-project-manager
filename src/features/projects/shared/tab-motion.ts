import type { Section } from './view-model';

export type TabItem = { key: string; label: string; href: string };
/** The details tab followed by the sections this viewer may see. One list for the phone tabs, the desktop tabs and the slide. */
export function tabItems(projectId: string, sections: Section[]): TabItem[] {
  return [{ key: 'details', label: 'פרטים', href: `/projects/${projectId}` }, ...sections];
}

/** Pure helpers for the project tabs: which tab a path belongs to and which way the content slides. */
export function tabIndex(pathname: string, hrefs: string[]): number {
  let best = -1;
  hrefs.forEach((href, i) => {
    if ((pathname === href || pathname.startsWith(`${href}/`)) && (best === -1 || href.length > hrefs[best].length)) best = i;
  });
  if (best !== -1) return best;
  // The id in the address may differ from the id in the links (case, encoding): fall back to the section name.
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'projects' || parts.length < 2) return -1;
  if (parts.length === 2) return 0;
  return hrefs.findIndex(href => href.split('/').filter(Boolean)[2] === parts[2]);
}

/**
 * In RTL the tabs run right to left, so a later tab is further left: its content enters from the left.
 * Returns the side the new content comes from, or null when there is nothing to animate.
 */
export function slideFrom(previous: number, next: number): 'left' | 'right' | null {
  if (previous < 0 || next < 0 || previous === next) return null;
  return next > previous ? 'left' : 'right';
}
