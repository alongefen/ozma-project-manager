import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { desktopNav, HOME_PATH, moreLinks, phoneNav, REPORT_PATH, SIGN_IN_PATH, screenTitle } from '@/lib/navigation';

// P2.8: every link in the shells must lead to a real page (no 404), for every role.
const pageFile = (href: string) => {
  const path = href.split('?')[0];
  const group = path === SIGN_IN_PATH ? 'src/app/(auth)' : 'src/app/(app)';
  return `${group}${path}/page.tsx`;
};

describe('navigation targets exist', () => {
  const all = [true, false].flatMap(isOwner => [...phoneNav(isOwner), ...desktopNav(isOwner), ...moreLinks(isOwner)]);
  it.each([...new Set(all.map(i => i.href))])('%s has a page', href => {
    expect(existsSync(pageFile(href)), pageFile(href)).toBe(true);
  });
  it('sign-in lands on the project list, which exists', () => {
    expect(HOME_PATH).toBe('/projects');
    expect(existsSync(pageFile(HOME_PATH))).toBe(true);
    expect(existsSync(pageFile(REPORT_PATH))).toBe(true);
  });
  it('titles the diary print page, which the diary reaches by a button', () => {
    expect(screenTitle('/reports/diary')).toBe('הדפסת יומן לפי תאריך');
    expect(existsSync(pageFile('/reports/diary'))).toBe(true);
  });
  it('titles every linked screen instead of the generic fallback', () => {
    for (const item of all) expect(screenTitle(item.href.split('?')[0]), item.href).not.toBe('חי עוצמה');
  });
});
