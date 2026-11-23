import { describe, expect, it } from 'vitest';
import { isInnerRoute } from '@/components/shell/inner';

describe('inner routes (own PageHeader, no phone shell title)', () => {
  it.each(['/projects/abc', '/projects/abc/finance', '/projects/new', '/diary/new'])('%s is inner', p => expect(isInnerRoute(p)).toBe(true));
  it.each(['/projects', '/more', '/diary', '/finance', '/'])('%s is top level', p => expect(isInnerRoute(p)).toBe(false));
  it('ignores a query string and trailing slash', () => {
    expect(isInnerRoute('/projects?archive=1')).toBe(false);
    expect(isInnerRoute('/projects/')).toBe(false);
  });
});
