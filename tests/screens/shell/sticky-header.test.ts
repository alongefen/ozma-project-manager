// Guards the pinned top (STICKY-HEADER): header, project tabs and each screen's action row stay on screen while the
// page scrolls. Source-level checks, so they run without a browser.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');
const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

describe('ראש עמוד נעוץ', () => {
  it('PageHeader עטוף ב-PinHead ומעביר את הטאבים כילדים', () => {
    const src = read('src/components/ui/PageHeader.tsx');
    expect(src).toContain('<PinHead>');
    expect(src).toMatch(/\{children\}\s*<\/PinHead>/);
  });
  it('מסגרת הפרויקט שמה את הטאבים בתוך PageHeader (נעוצים יחד עם הכותרת)', () => {
    const src = read('src/features/projects/shared/ProjectFrame.tsx');
    expect(src).toMatch(/<PageHeader[\s\S]*<ProjectTabs[\s\S]*<ProjectInnerNav[\s\S]*<\/PageHeader>/);
  });
  it('PinHead מפרסם את הגובה שלו כ---pin-h ו-CSS מצמיד שורות פעולה מתחתיו', () => {
    expect(read('src/components/ui/PinHead.tsx')).toContain('--pin-h');
    const css = read('src/styles/app.css');
    expect(css).toMatch(/\.ui-pinhead\s*\{[^}]*position: sticky/);
    expect(css).toMatch(/\.ui-pin\s*\{[^}]*position: sticky[^}]*var\(--pin-h/);
  });
  it('אף מסך לא כותב position: sticky בעצמו (רק המנגנון המשותף, ופס הטופס/הטבלה)', () => {
    const allowed = ['src/styles/app.css', 'src/features/overview/desktop/Desktop.module.css'];
    const offenders = walk('src').filter(p => p.endsWith('.css') && !allowed.includes(p) && /position:\s*sticky/.test(read(p)));
    expect(offenders).toEqual([]);
  });
  it('שורות הפעולה הראשיות של כל מסך משתמשות ב-Pin', () => {
    const screens = [
      'src/features/diary/shared/DiaryToolbar.tsx',
      'src/features/files/desktop/FilesDesktop.tsx', 'src/features/files/mobile/FilesMobile.tsx',
      'src/features/tasks/desktop/TasksDesktop.tsx', 'src/features/tasks/mobile/TasksMobile.tsx',
      'src/features/finance/desktop/FinanceDesktop.tsx', 'src/features/finance/mobile/FinanceMobile.tsx',
      'src/features/users/shared/UsersManager.tsx',
    ];
    for (const p of screens) expect(read(p), p).toMatch(/<Pin[\s>]/);
  });
});
