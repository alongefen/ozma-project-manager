import { describe, expect, it } from 'vitest';
import { addDays, addMonths, formatDisplay, monthGrid, parseIso, todayIso } from '@/components/ui/calendar';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateField, SelectField } from '@/components/ui';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

describe('calendar helpers', () => {
  it('shows DD/MM/YYYY and rejects impossible dates', () => {
    expect(formatDisplay('2026-11-24')).toBe('24/11/2026');
    expect(formatDisplay('2026-02-31')).toBe('');
    expect(parseIso('2026-13-01')).toBeNull();
    expect(parseIso('')).toBeNull();
  });
  it('month grid starts on Sunday and has 6 full weeks', () => {
    const grid = monthGrid(2026, 11); // 1 Nov 2026 is a Sunday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toMatchObject({ iso: '2026-11-01', inMonth: true });
    expect(monthGrid(2026, 12)[0].iso).toBe('2026-11-29'); // 1 Dec 2026 is a Tuesday: Sunday 29 Nov first
    expect(grid.filter(c => c.inMonth)).toHaveLength(30);
  });
  it('moves days and months, clamping the day', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(todayIso(new Date(2026, 10, 24))).toBe('2026-11-24');
  });
});

describe('DateField / SelectField markup', () => {
  it('date field shows the Hebrew-format value and submits ISO', () => {
    const html = renderToStaticMarkup(h(DateField, { label: 'מתאריך', name: 'from', defaultValue: '2026-11-24' }));
    expect(html).toContain('24/11/2026');
    expect(html).toContain('<input type="hidden" name="from" value="2026-11-24"/>');
  });
  it('select field shows the chosen label and submits its value', () => {
    const html = renderToStaticMarkup(h(SelectField, { label: 'פרויקט', name: 'project', defaultValue: 'b', options: [{ value: 'a', label: 'אלף' }, { value: 'b', label: 'בית' }] }));
    expect(html).toContain('בית');
    expect(html).toContain('name="project" value="b"');
  });
});

describe('no native date or select left in screens', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  // PrintByDate belongs to PRINT-EXPORT for now; remove from the list when it is converted.
  const parked = ['src/features/diary/shared/PrintByDate.tsx'];
  it('uses DateField / SelectField everywhere', () => {
    const offenders = walk('src').filter(p => /\.tsx$/.test(p) && !parked.includes(p) && /<select[\s>]|type="date"/.test(readFileSync(p, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
