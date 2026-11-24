// PRINT-EXPORT: printing outputs only the screen's data. Source-level checks, so they run without a browser.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('הדפסה', () => {
  it('הדפסה מסתירה כותרת נעוצה, טאבי פרויקט, שורות פעולה, ניווט ומעטפת', () => {
    const css = read('src/styles/app.css');
    const block = /@media print \{([^}]*)\}/.exec(css)?.[1] ?? '';
    for (const cls of ['.ui-pinhead', '.ui-pin', '.no-print', '.m-header', '.m-nav', '.d-aside', '.d-header']) expect(block).toContain(cls);
    expect(block).toContain('display: none !important');
  });
  it('הדפסת כספים: A4, והמסך עצמו מוסתר', () => {
    const css = read('src/features/finance/shared/finance.css');
    expect(css).toContain('size: A4');
    expect(css).toMatch(/@media print[\s\S]*\.fin-mobile, \.fin-desktop/);
  });
  it('בכספים הדפסה וייצוא הם שתי פעולות נפרדות', () => {
    for (const file of ['src/features/finance/desktop/FinanceDesktop.tsx', 'src/features/finance/mobile/FinanceMobile.tsx']) {
      const src = read(file);
      expect(src).toContain('window.print()');
      expect(src).toContain('exportHref(');
      expect(src).not.toMatch(/הדפסה\s*\/\s*PDF/);
    }
  });
});
