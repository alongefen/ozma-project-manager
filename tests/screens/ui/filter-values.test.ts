import { describe, expect, it } from 'vitest';
import { periodFilterFromValues, phoneFilterFromValues } from '@/features/finance/shared/query';
import { filterHref } from '@/features/diary/shared/model';

const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const base = { year: 2026, month: 11 };

describe('filter popup values to filters', () => {
  it('desktop finance: month, year and day; empty month is the whole period; search is kept', () => {
    expect(periodFilterFromValues(form({ month: '3', year: '2025', day: '15' }), base, 'ספק')).toEqual({ period: { year: 2025, month: 3 }, day: 15, search: 'ספק' });
    expect(periodFilterFromValues(form({ month: '', year: '2025', day: '' }), base)).toEqual({ period: 'all' });
    expect(periodFilterFromValues(form({ month: '4', year: '', day: '' }), base).period).toEqual({ year: 2026, month: 4 });
  });
  it('desktop finance: a day outside 1-31 or not a number is dropped', () => {
    for (const day of ['0', '32', 'x', '1.5']) expect(periodFilterFromValues(form({ month: '', year: '', day }), base)).toEqual({ period: 'all' });
  });
  it('phone finance: project, day and search; the period stays as chosen on the switch', () => {
    expect(phoneFilterFromValues(form({ project: 'p1', day: '7', search: ' בטון ' }), 'all')).toEqual({ filter: { period: 'all', day: 7, search: 'בטון' }, project: 'p1' });
    expect(phoneFilterFromValues(form({ project: '', day: '', search: '' }), base)).toEqual({ filter: { period: base }, project: null });
  });
  it('diary: only chosen values reach the address; nothing chosen is the bare path', () => {
    expect(filterHref('/diary', form({ project: 'p1', from: '2026-11-01', to: '' }))).toBe('/diary?project=p1&from=2026-11-01');
    expect(filterHref('/projects/x/diary', form({ from: '', to: '' }))).toBe('/projects/x/diary');
    expect(filterHref('/diary', form({ project: '', from: '2026-11-01', to: '2026-11-20' }))).toBe('/diary?from=2026-11-01&to=2026-11-20');
  });
});
