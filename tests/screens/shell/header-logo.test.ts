// HEADER-LOGO: the company logo sits in the phone header, never on desktop. Renders the components to static markup.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/projects' }));
vi.mock('next/link', () => ({ default: ({ href, children, ...p }: { href: string; children: unknown }) => createElement('a', { href, ...p }, children as never) }));

import { HeaderLogo } from '@/components/ui/PageHeaderLogo';
import { PageHeader } from '@/components/ui/PageHeader';
import { MobileHeader } from '@/components/shell/mobile/MobileHeader';

const read = (p: string) => readFileSync(p, 'utf8');

describe('לוגו בכותרת הטלפון', () => {
  it('הלוגו הוא תמונה עם alt בעברית, טעינה מיידית ועדיפות גבוהה', () => {
    const html = renderToStaticMarkup(createElement(HeaderLogo));
    expect(html).toContain('src="/brand/logo.webp"');
    expect(html).toContain('alt="חי עוצמה בבנייה"');
    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchPriority="high"');
    expect(html).not.toContain('lazy');
  });
  it('הכותרת של מסך עליון בטלפון מציגה את הלוגו, גם כשיש כפתור חשבון', () => {
    for (const showAccount of [true, false]) {
      const html = renderToStaticMarkup(createElement(MobileHeader, { fullName: 'דנה כהן', showAccount }));
      expect(html).toContain('class="m-header m-only"');
      expect(html).toContain('/brand/logo.webp');
      expect(html.includes('m-header__account')).toBe(showAccount);
    }
  });
  it('PageHeader מציג את הלוגו אחרי הכותרת והפעולות', () => {
    const html = renderToStaticMarkup(createElement(PageHeader, { title: 'כותרת', backHref: '/projects', backLabel: 'חזרה', actions: createElement('button', null, 'x') }));
    expect(html).toContain('ui-ph__logo');
    expect(html.indexOf('ui-ph__actions')).toBeLessThan(html.indexOf('<img'));
  });
  it('הלוגו מוסתר בדסקטופ (m-only) ולא מתכווץ ולא שובר יחס', () => {
    expect(renderToStaticMarkup(createElement(HeaderLogo))).toContain('m-only');
    const css = read('src/styles/app.css');
    expect(css).toMatch(/\.m-only \{ display: none !important/);
    expect(css).toMatch(/\.ui-hlogo\s*\{[^}]*flex: none[^}]*width: auto/);
  });
});
