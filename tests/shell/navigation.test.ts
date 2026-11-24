import { describe, expect, it } from 'vitest';
import { activeItem, desktopNav, navHref, reportHref, initials, isActive, moreLinks, phoneNav, screenTitle } from '@/lib/navigation';

describe('phone navigation', () => {
  it.each([true, false])('has an odd number of items with the report button in the middle (owner=%s)', isOwner => {
    const items = phoneNav(isOwner);
    expect(items.length % 2).toBe(1);
    expect(items[(items.length - 1) / 2].key).toBe('report');
    expect(items.filter(i => i.prominent)).toHaveLength(1);
  });
  it('gives the owner five items and everyone else three, without finance or more', () => {
    expect(phoneNav(true).map(i => i.key)).toEqual(['projects', 'diary', 'report', 'finance', 'more']);
    expect(phoneNav(false).map(i => i.key)).toEqual(['projects', 'report', 'diary']);
  });
  it('never offers the owner-only areas to non-owners', () => {
    const forbidden = ['finance', 'users', 'more', 'archive', 'log'];
    const visible = [...phoneNav(false), ...desktopNav(false), ...moreLinks(false)].map(i => i.key);
    for (const key of forbidden) expect(visible).not.toContain(key);
    expect(moreLinks(false)).toEqual([]);
  });
  it('keeps the report entry on desktop for everyone', () => {
    expect(desktopNav(true).some(i => i.key === 'report')).toBe(true);
    expect(desktopNav(false).some(i => i.key === 'report')).toBe(true);
  });
});

describe('active item', () => {
  it('matches by path segment, not by prefix text', () => {
    expect(isActive('/projects/abc', '/projects')).toBe(true);
    expect(isActive('/projectsx', '/projects')).toBe(false);
  });
  it('highlights the report button on /diary/new and diary elsewhere under /diary', () => {
    const items = phoneNav(true);
    expect(activeItem('/diary/new', items)?.key).toBe('report');
    expect(activeItem('/diary', items)?.key).toBe('diary');
    expect(activeItem('/diary/2026-11-23', items)?.key).toBe('diary');
    expect(activeItem('/nowhere', items)).toBeUndefined();
  });
  it('titles screens in Hebrew', () => {
    expect(screenTitle('/diary/new')).toBe('דיווח חדש');
    expect(screenTitle('/projects/x/files')).toBe('פרויקטים');
    expect(screenTitle('/more')).toBe('עוד');
    expect(screenTitle('/unknown')).toBe('חי עוצמה');
  });
});

describe('initials', () => {
  it('uses first and last name', () => {
    expect(initials('בן יוסף')).toBe('בי');
    expect(initials('  דנה  ')).toBe('ד');
    expect(initials('')).toBe('?');
  });
});

describe('report button context (NEW-REPORT-CONTEXT)', () => {
  const A = '11111111-1111-4111-8111-111111111111';
  const B = '22222222-2222-4222-8222-222222222222';
  const report = phoneNav(true).find(i => i.key === 'report')!;
  it('goes to the current project diary with the window open, and to the general flow elsewhere', () => {
    expect(reportHref(`/projects/${A}`)).toBe(`/projects/${A}/diary?new=1`);
    expect(reportHref(`/projects/${A}/tasks`)).toBe(`/projects/${A}/diary?new=1`);
    for (const p of ['/projects', '/projects/new', '/', '/diary', '/diary/new', '/finance', '/more']) expect(reportHref(p)).toBe('/diary/new');
  });
  it('remembers nothing: A, then the list, then B, then the list', () => {
    const seq = [`/projects/${A}/diary`, '/projects', `/projects/${B}`, '/projects'];
    expect(seq.map(p => navHref(report, p))).toEqual([`/projects/${A}/diary?new=1`, '/diary/new', `/projects/${B}/diary?new=1`, '/diary/new']);
  });
  it('leaves the other items alone', () => {
    for (const i of phoneNav(true).filter(x => x.key !== 'report')) expect(navHref(i, `/projects/${A}`)).toBe(i.href);
  });
});
