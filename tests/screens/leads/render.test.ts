import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect,it,vi } from 'vitest';
vi.mock('@/features/leads/logic/actions',()=>({}));
import { LeadsProvider } from '@/features/leads/shared/LeadsProvider';
import { row,today } from './fixtures';
it('both views share rows; creation is first in pinned actions, phone stays LTR',()=>{const html=renderToStaticMarkup(createElement(LeadsProvider,{initial:[row(1)],today}));expect(html).toContain('m-only');expect(html).toContain('d-only');expect(html).toContain('class="ltr"');expect(html.indexOf('ליד חדש')).toBeLessThan(html.indexOf('חיפוש לידים'));expect(html).not.toContain('<select');expect(html).not.toContain('type="date"');});
it('empty list is honest and has zero counts',()=>{const html=renderToStaticMarkup(createElement(LeadsProvider,{initial:[],today}));expect(html).toContain('עדיין אין לידים');expect(html).toContain('(0%)');});
