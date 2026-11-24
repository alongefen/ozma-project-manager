// SKELETON-DATA: skeletons stand only where data will be. Loading files never draw a fake header or tab row, so navigating
// between pages keeps the page chrome (title, back link, tabs, action row) in place. Reads the route tree, no browser needed.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = 'src/app/(app)';
const read = (p: string) => readFileSync(p, 'utf8');
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const loadings = walk(APP).filter(f => f.endsWith('/loading.tsx'));

describe('קבצי loading: שלד רק איפה שיש נתונים', () => {
  it('יש קבצי loading', () => expect(loadings.length).toBeGreaterThan(10));

  it('אף שלד לא מצייר כותרת מדומה: PageSkeleton תמיד bare או frame, ובלי tabs', () => {
    for (const f of loadings) {
      const src = read(f);
      for (const tag of src.match(/<PageSkeleton[^>]*>/g) ?? []) {
        expect(tag, f).toMatch(/\b(bare|frame)\b/);
        expect(tag, f).not.toMatch(/\btabs\b/);
      }
    }
  });

  it('מסך פנימי (עריכה, הרשאות, דוח) מציג את הכותרת האמיתית וחץ החזרה מיד', () => {
    for (const f of ['projects/[id]/edit', 'projects/[id]/edit/access', 'reports/diary']) {
      expect(read(join(APP, f, 'loading.tsx')), f).toContain('InnerPageSkeleton');
    }
  });

  it('לכל מסך שמביא נתונים יש loading משלו (לא נופל לשלד כללי)', () => {
    const pages = ['projects', 'finance', 'diary', 'diary/new', 'users', 'reports/diary', 'projects/[id]', 'projects/[id]/edit', 'projects/[id]/edit/access'];
    for (const p of pages) expect(existsSync(join(APP, p, 'loading.tsx')), p).toBe(true);
  });

  it('שורת פעולות וכותרת סטטית משוקפות בשלד של מסכי הרשימות', () => {
    expect(read(join(APP, 'projects/loading.tsx'))).toContain('title="פרויקטים"');
    expect(read(join(APP, 'finance/loading.tsx'))).toContain('title="כספים"');
    for (const f of ['diary', 'users', 'projects/[id]/(tabs)/files', 'projects/[id]/(tabs)/tasks']) expect(read(join(APP, f, 'loading.tsx')), f).toMatch(/\bbar=/);
  });

  it('השלד הכללי של (app) הוא תוכן בלבד', () => {
    expect(read(join(APP, 'loading.tsx'))).toMatch(/PageSkeleton\s+bare/);
  });
});
