import { describe, expect, it } from 'vitest';
import { slideFrom, tabIndex } from '@/features/projects/shared/tab-motion';

const hrefs = ['/projects/p', '/projects/p/files', '/projects/p/tasks', '/projects/p/diary', '/projects/p/finance'];

describe('טאבים בפרויקט: אנימציית החלקה', () => {
  it('מזהה את הטאב לפי הכתובת, גם בעמוד פנימי', () => {
    expect(tabIndex('/projects/p', hrefs)).toBe(0);
    expect(tabIndex('/projects/p/finance', hrefs)).toBe(4);
    expect(tabIndex('/projects/p/files/123', hrefs)).toBe(1);
    expect(tabIndex('/projects/p/edit', hrefs)).toBe(0);
    expect(tabIndex('/more', hrefs)).toBe(-1);
  });
  it('טאב מאוחר יותר (משמאל) נכנס משמאל, מוקדם יותר נכנס מימין', () => {
    expect(slideFrom(0, 4)).toBe('left');
    expect(slideFrom(4, 1)).toBe('right');
  });
  it('אין אנימציה באותו טאב או כשאין טאב', () => {
    expect(slideFrom(2, 2)).toBeNull();
    expect(slideFrom(-1, 2)).toBeNull();
    expect(slideFrom(2, -1)).toBeNull();
  });
});
