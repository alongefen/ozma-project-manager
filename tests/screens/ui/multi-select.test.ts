import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MultiSelectField } from '@/components/ui';

const options = [{ value: 'a', label: 'דנה בדויה' }, { value: 'b', label: 'יוסי בדוי' }, { value: 'c', label: 'רונית בדויה' }];
describe('MultiSelectField', () => {
  it('shows each chosen value as a chip with its own remove button', () => {
    const html = renderToStaticMarkup(h(MultiSelectField, { label: 'אחראים', value: ['a', 'c'], options, onChange: () => {} }));
    expect(html).toContain('דנה בדויה');
    expect(html).toContain('aria-label="הסרת דנה בדויה"');
    expect(html).toContain('aria-label="הסרת רונית בדויה"');
    expect(html).not.toContain('הסרת יוסי בדוי');
  });
  it('shows the placeholder and no chips when nothing is chosen', () => {
    const html = renderToStaticMarkup(h(MultiSelectField, { label: 'אחראים', placeholder: 'בחירת אחראים', value: [], options, onChange: () => {} }));
    expect(html).toContain('בחירת אחראים');
    expect(html).not.toContain('הסרת');
  });
});
