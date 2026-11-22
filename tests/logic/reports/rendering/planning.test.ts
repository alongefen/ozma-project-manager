import { describe, expect, it } from 'vitest';
import { planReport } from '../../../../src/features/reports/logic/rendering/index';

import { input } from './fixtures';

describe('report planning', () => {
  it('keeps an empty date as a printable part', () => {
    const parts = planReport({ ...input, scope: { kind: 'day', date: '2026-01-02' }, entries: [] });
    expect(parts).toHaveLength(1);
    expect(parts[0].entries).toEqual([]);
    expect(parts[0].workDays).toBe(0);
  });
  it('sorts chronologically and does not mutate input', () => {
    const entries = [{ ...input.entries[0], id: 'late', workDate: '2026-01-03' }, input.entries[0]];
    expect(planReport({ ...input, entries })[0].entries.map(e => e.id)).toEqual(['a', 'late']);
    expect(entries[0].id).toBe('late');
  });
  it('splits at 200 reports without dropping reports', () => {
    const entries = Array.from({ length: 401 }, (_, i) => ({ ...input.entries[0], id: String(i) }));
    const parts = planReport({ ...input, entries });
    expect(parts.map(p => p.entries.length)).toEqual([200, 200, 1]);
    expect(parts.map(p => [p.number, p.total])).toEqual([[1, 3], [2, 3], [3, 3]]);
  });
  it('rejects a report larger than 75 MiB explicitly', () => {
    const entries = [{ ...input.entries[0], attachments: [{ name: 'large.pdf', mediaType: 'application/pdf', bytes: new Uint8Array(75 * 1024 * 1024 + 1) }] }];
    expect(() => planReport({ ...input, entries })).toThrow();
  });
  it('splits by bytes without splitting a report', () => {
    const bytes = new Uint8Array(40 * 1024 * 1024);
    const entries = ['a', 'b'].map(id => ({ ...input.entries[0], id, attachments: [{ name: 'test.pdf', mediaType: 'application/pdf', bytes }] }));
    const parts = planReport({ ...input, entries });
    expect(parts.map(p => p.entries.length)).toEqual([1, 1]);
    expect(parts.every(p => p.inputBytes <= 75 * 1024 * 1024)).toBe(true);
  });
  it('rejects duplicate ids and out-of-scope data', () => {
    expect(() => planReport({ ...input, entries: [input.entries[0], input.entries[0]] })).toThrow();
    expect(() => planReport({ ...input, scope: { kind: 'entry', entryId: 'other' } })).toThrow();
    expect(() => planReport({ ...input, scope: { kind: 'day', date: '2026-01-01' } })).toThrow();
  });
  it('counts UTF-8 text bytes and enforces the exact byte boundary', () => {
    const entry = { ...input.entries[0], text: 'שלום', attachments: [{ name: 'x.pdf', mediaType: 'application/pdf', bytes: new Uint8Array() }] };
    const overhead = planReport({ ...input, entries: [entry] })[0].inputBytes;
    entry.attachments[0].bytes = new Uint8Array(75 * 1024 * 1024 - overhead);
    expect(planReport({ ...input, entries: [entry] })[0].inputBytes).toBe(75 * 1024 * 1024);
    expect(() => planReport({ ...input, entries: [{ ...entry, text: entry.text + 'א' }] })).toThrow(/a/);
  });
  it('requires timezone-aware creation timestamps', () => {
    expect(() => planReport({ ...input, entries: [{ ...input.entries[0], createdAt: '2026-01-03T08:00:00' }] })).toThrow();
  });
  it('rejects a reversed range and impossible date', () => {
    expect(() => planReport({ ...input, scope: { kind: 'range', from: '2026-02-01', to: '2026-01-01' } })).toThrow();
    expect(() => planReport({ ...input, entries: [{ ...input.entries[0], workDate: '2026-02-30' }] })).toThrow();
  });
});
