// Guards the project tab navigation (TAB-NAV-FIX): the frame and header stay mounted while only the tab content
// loads and slides. These tests read the route tree and the pure motion helpers, so they run without a browser.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { slideFrom, tabIndex, tabItems } from '@/features/projects/shared/tab-motion';
import { sectionsFor } from '@/features/projects/shared/view-model';

const ID_DIR = 'src/app/(app)/projects/[id]';
const TABS_DIR = join(ID_DIR, '(tabs)');
const read = (p: string) => readFileSync(p, 'utf8');
const subdirs = (dir: string) => readdirSync(dir).filter(n => statSync(join(dir, n)).isDirectory());

describe('מבנה הנתיבים של טאבי הפרויקט', () => {
  it('כל טאב הוא נתיב תחת (tabs), וכל נתיב כזה עם loading משלו שהוא תוכן בלבד', () => {
    for (const tab of subdirs(TABS_DIR)) {
      expect(existsSync(join(TABS_DIR, tab, 'page.tsx')), `${tab}/page.tsx`).toBe(true);
      const loading = join(TABS_DIR, tab, 'loading.tsx');
      expect(existsSync(loading), `${tab}/loading.tsx`).toBe(true);
      expect(read(loading), `${tab}/loading.tsx must be bare`).toMatch(/PageSkeleton[^>]*\bbare\b/);
    }
  });
  it('לטאב הפרטים (שורש הקבוצה) יש loading של תוכן בלבד', () => {
    expect(read(join(TABS_DIR, 'loading.tsx'))).toMatch(/PageSkeleton[^>]*\bbare\b/);
  });
  it('הפריים (כותרת וטאבים) חי ב-layout של (tabs), ולא נעטף בשלד של כל העמוד', () => {
    const layout = read(join(TABS_DIR, 'layout.tsx'));
    expect(layout).toContain('ProjectFrame');
    const frame = read('src/features/projects/shared/ProjectFrame.tsx');
    expect(frame).toContain('TabSlide');
    expect(frame).toContain('PageHeader');
  });
  it('אף טאב לא יושב מחוץ ל-(tabs) (ליד edit/permissions), כי אז הפריים נטען מחדש', () => {
    const outside = subdirs(ID_DIR).filter(n => n !== '(tabs)');
    expect(outside.sort()).toEqual(['edit']);
  });
  it('שלד טאב לא כולל כותרת ושורת טאבים (אין PageSkeleton עם tabs בתוך (tabs))', () => {
    for (const f of [join(TABS_DIR, 'loading.tsx'), ...subdirs(TABS_DIR).map(t => join(TABS_DIR, t, 'loading.tsx'))]) {
      expect(read(f)).not.toMatch(/<PageSkeleton\s+tabs/);
    }
  });
});

describe('סדר הטאבים והחלקה (מימין לשמאל)', () => {
  const viewAll = { id: 'p', permissions: { viewFinance: true } } as Parameters<typeof sectionsFor>[0];
  const hrefs = tabItems('p', sectionsFor(viewAll)).map(i => i.href);
  it('הפרטים ראשון, ואחריו המסמכים, המשימות, היומן, ההערות והכספים', () => {
    expect(hrefs).toEqual(['/projects/p', '/projects/p/files', '/projects/p/tasks', '/projects/p/diary', '/projects/p/notes', '/projects/p/finance']);
  });
  it('כל טאב מזוהה לפי הכתובת שלו', () => {
    hrefs.forEach((h, i) => expect(tabIndex(h, hrefs)).toBe(i));
  });
  it('מעבר קדימה בסדר נכנס משמאל, אחורה נכנס מימין, בכל זוג טאבים', () => {
    for (let a = 0; a < hrefs.length; a++) for (let b = 0; b < hrefs.length; b++) {
      const dir = slideFrom(tabIndex(hrefs[a], hrefs), tabIndex(hrefs[b], hrefs));
      expect(dir).toBe(a === b ? null : b > a ? 'left' : 'right');
    }
  });
  it('בלי הרשאת כספים הטאב נעלם והכיוונים נשארים נכונים', () => {
    const noFin = tabItems('p', sectionsFor({ id: 'p', permissions: { viewFinance: false } } as Parameters<typeof sectionsFor>[0])).map(i => i.href);
    expect(noFin).not.toContain('/projects/p/finance');
    expect(slideFrom(tabIndex('/projects/p/diary', noFin), tabIndex('/projects/p', noFin))).toBe('right');
  });
});
