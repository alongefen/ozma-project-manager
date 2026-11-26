import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { expect, it } from 'vitest';
import { FormActions, Sheet } from '@/components/ui';

it('keeps default FormActions callers compatible, including cancel destinations and extra actions', () => {
 const html=render(h(FormActions,{submitLabel:'שמירה',cancelHref:'/projects',extra:h('span',null,'עוד')}));
 expect(html).toContain('type="submit"');
 expect(html).toContain('href="/projects"');
 expect(html).toContain('ביטול');
 expect(html).toContain('עוד');
});
it('renders a separate footer linked to exactly one real form without a Cancel button', () => {
 const html=render(h(Sheet,{open:true,title:'פרטי ליד',onClose:()=>{},footer:h(FormActions,{submitLabel:'שמירה',form:'lead-editor',hideCancel:true,spread:true,busy:true,extra:h('button',{type:'button'},'ארכיון')}),children:h('form',{id:'lead-editor'},h('input',{name:'name'}))}));
 expect(html).toMatch(/<form id="lead-editor">.*<\/form><\/div><footer/);
 expect(html).toContain('form="lead-editor" disabled=""');
 expect(html.match(/type="submit"/g)).toHaveLength(1);
 expect(html).not.toContain('ביטול');
 expect(html).toContain('type="button">ארכיון');
});
it('omits the footer for an unchanged Sheet caller',()=>{
 const html=render(h(Sheet,{open:true,title:'פרטים',onClose:()=>{},children:h('p',null,'תוכן')}));
 expect(html).toContain('תוכן');expect(html).not.toContain('<footer');
});
