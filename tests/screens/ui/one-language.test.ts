import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Button, DeleteIcon, DesktopTitle, EditIcon, IconButton } from '@/components/ui';

// UX-AUDIT: one language for actions. These are source scans like the picker and sticky tests: a screen that
// draws its own icon, icon button or "+ label" fails here, so the next screen cannot drift.

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(tsx|css)$/.test(name)) out.push(path);
  }
  return out;
}
const features = files('src/features');
const read = (p: string) => readFileSync(p, 'utf8');

describe('shared action controls', () => {
  it('no feature defines its own icon button or action icon', () => {
    const own = features.filter(f => /-iconbtn|\biconBtn\b|removeBtn/.test(read(f)));
    expect(own).toEqual([]);
    const icons = features.filter(f => f.endsWith('.tsx') && /\b(Pencil|Trash|Download)Icon\b/.test(read(f)));
    expect(icons).toEqual([]);
  });
  it('create buttons use the plus icon, never a "+ " in the label', () => {
    const plus = features.filter(f => f.endsWith('.tsx') && /<Button[^>]*>\s*\+ /.test(read(f)));
    expect(plus).toEqual([]);
  });
  it('an icon button always has a name and a tooltip; danger is the bin', () => {
    const out = renderToStaticMarkup(h(IconButton, { label: 'מחיקה', tone: 'danger', children: h(DeleteIcon) }));
    expect(out).toContain('aria-label="מחיקה"');
    expect(out).toContain('title="מחיקה"');
    expect(out).toContain('ui-iconbtn ui-iconbtn--danger');
    const link = renderToStaticMarkup(h(IconButton, { label: 'ייצוא', href: '/x', children: h(EditIcon) }));
    expect(link).toMatch(/^<a class="ui-iconbtn" href="\/x"/);
  });
  it('the add button draws the plus before its label', () => {
    const out = renderToStaticMarkup(h(Button, { icon: 'add' }, 'הוספת אדם'));
    expect(out).toMatch(/<button[^>]*><svg class="ui-aicon"[^>]*>.*<\/svg>הוספת אדם<\/button>/);
  });
});

describe('page titles', () => {
  it('the desktop title is the same ui-ph row everywhere', () => {
    expect(renderToStaticMarkup(h(DesktopTitle, { title: 'עובדים והרשאות' }))).toBe('<div class="ui-ph d-only"><div class="ui-ph__row"><h1 class="ui-ph__title">עובדים והרשאות</h1></div></div>');
  });
  it('every top-level screen renders DesktopTitle (or its own ui-ph header), none draws a local title', () => {
    for (const page of ['users/page.tsx', 'finance/page.tsx', 'diary/page.tsx']) expect(existsSync(join('src/app/(app)', page))).toBe(true);
    expect(read('src/app/(app)/users/page.tsx')).toContain('<DesktopTitle title="עובדים והרשאות" />');
    expect(read('src/app/(app)/finance/page.tsx')).toContain('<DesktopTitle title="כספים" />');
    expect(read('src/features/diary/desktop/DiaryDesktop.tsx')).toContain('<DesktopTitle');
    const local = features.filter(f => /(dr|tk|fl|fin|users?)-?[a-z]*(bar|head)__title|__title\s*\{[^}]*22px/.test(read(f)));
    expect(local).toEqual([]);
  });
  it('a forbidden or missing page shows the app message inside the shell, not the framework 404', () => {
    expect(read('src/app/(app)/not-found.tsx')).toContain('StateMessage');
  });
});
