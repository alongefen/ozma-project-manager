import { describe, expect, it } from 'vitest';
import {
  MAX_INPUT_BYTES, planReport, planReportManifest, ReportLimitError,
  type ReportInput, type ReportManifestInput, type ReportManifestPart, type ReportPart,
} from '../../../../src/features/reports/logic/rendering/index';
import { input } from './fixtures';

const toManifest = (report: ReportInput): ReportManifestInput => ({
  projectName: report.projectName,
  scope: report.scope,
  entries: report.entries.map(({ attachments, ...fields }) => ({
    ...fields,
    attachments: attachments?.map(item => ({ name: item.name, mediaType: item.mediaType, byteLength: item.bytes.byteLength })),
  })),
});
const partition = (parts: (ReportPart | ReportManifestPart)[]) => parts.map(part => ({
  number: part.number, total: part.total, inputBytes: part.inputBytes, workDays: part.workDays,
  projectName: part.projectName, scope: part.scope, ids: part.entries.map(entry => entry.id),
}));
const withSize = (byteLength: unknown): ReportManifestInput => ({
  ...input,
  entries: [{ ...input.entries[0], attachments: [{ name: 'x.pdf', mediaType: 'application/pdf', byteLength: byteLength as number }] }],
});
function thrownBy(run: () => unknown): unknown {
  try { run(); } catch (error) { return error; }
  throw new Error('expected a failure');
}

// One backing buffer: hundreds of "large" attachments without allocating gigabytes.
const pool = new Uint8Array(12 * 1024 * 1024);
function mixedReport(seed: number, count: number, maxAttachmentBytes: number): ReportInput {
  let value = seed;
  const random = () => (value = value * 48271 % 2147483647) / 2147483647;
  const entries = Array.from({ length: count }, (_, i) => ({
    ...input.entries[0],
    id: `entry-${i}`,
    workDate: `2026-01-${String(Math.floor(random() * 28) + 1).padStart(2, '0')}`,
    createdAt: `2026-02-01T${String(Math.floor(random() * 24)).padStart(2, '0')}:00:00Z`,
    text: 'טקסט בעברית "ציטוט"\n'.repeat(Math.floor(random() * 30)),
    attachments: Array.from({ length: Math.floor(random() * 4) }, (_, j) => ({
      name: `קובץ ${i}-${j}.jpg`,
      mediaType: j % 2 ? 'application/pdf' : 'image/jpeg',
      bytes: pool.subarray(0, Math.floor(random() * maxAttachmentBytes)),
    })),
  }));
  return { ...input, entries };
}

describe('planning on a manifest', () => {
  it.each([
    ['empty', 1, 0, 0],
    ['split by count', 7, 401, 1024],
    ['split by bytes', 11, 60, pool.length],
    ['split by both', 13, 700, 1024 * 1024],
  ] as const)('gives the byte partition: %s', (_name, seed, count, size) => {
    const report = mixedReport(seed, count, size);
    expect(partition(planReportManifest(toManifest(report)))).toEqual(partition(planReport(report)));
  });
  it.each([0, 1])('agrees at the exact 75MiB boundary plus %d', extra => {
    const overhead = planReportManifest(withSize(0))[0].inputBytes;
    const byteLength = MAX_INPUT_BYTES - overhead + extra;
    if (extra) expect(() => planReportManifest(withSize(byteLength))).toThrow(ReportLimitError);
    else expect(planReportManifest(withSize(byteLength))[0].inputBytes).toBe(MAX_INPUT_BYTES);
  });
  it('keeps the manifest attachments as they are', () => {
    const manifest = withSize(1234);
    expect(planReportManifest(manifest)[0].entries).toEqual(manifest.entries);
  });
  it('sorts without changing its input', () => {
    const manifest: ReportManifestInput = { ...input, entries: [{ ...input.entries[0], id: 'late', workDate: '2026-01-03', attachments: [] }, { ...input.entries[0], attachments: [] }] };
    expect(planReportManifest(manifest)[0].entries.map(entry => entry.id)).toEqual(['a', 'late']);
    expect(manifest.entries[0].id).toBe('late');
  });
  it.each([
    ['negative', -1], ['fraction', 1.5], ['NaN', Number.NaN], ['infinite', Infinity], ['unsafe', 2 ** 53],
    ['string', '10'], ['null', null], ['missing', undefined],
  ])('rejects a %s byteLength as invalid, not as a limit', (_name, value) => {
    const error = thrownBy(() => planReportManifest(withSize(value)));
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ReportLimitError);
  });
  it.each([
    ['duplicate id', { ...input, entries: [input.entries[0], input.entries[0]] }],
    ['out of scope', { ...input, scope: { kind: 'day', date: '2026-01-01' } }],
    ['reversed range', { ...input, scope: { kind: 'range', from: '2026-02-01', to: '2026-01-01' } }],
    ['no time zone', { ...input, entries: [{ ...input.entries[0], createdAt: '2026-01-03T08:00:00' }] }],
    ['no project name', { ...input, projectName: ' ' }],
  ])('validates like planReport: %s', (_name, report) => {
    const byBytes = thrownBy(() => planReport(report as ReportInput)) as Error;
    const byManifest = thrownBy(() => planReportManifest(report as ReportManifestInput)) as Error;
    expect(byManifest.message).toBe(byBytes.message);
    expect(byManifest).not.toBeInstanceOf(ReportLimitError);
  });
});

describe('the typed limit error', () => {
  const entryMessage = 'דיווח a חורג לבדו ממגבלת 75MiB; לא הופק דוח חלקי';
  const headerMessage = 'כותרת הדוח חורגת ממגבלת 75MiB';

  it.each([MAX_INPUT_BYTES, Number.MAX_SAFE_INTEGER])('marks a manifest entry of %d bytes', size => {
    const error = thrownBy(() => planReportManifest(withSize(size)));
    expect(error).toBeInstanceOf(ReportLimitError);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(entryMessage);
  });
  it('marks an oversized entry in planReport', () => {
    const bytes = new Uint8Array(MAX_INPUT_BYTES);
    const report = { ...input, entries: [{ ...input.entries[0], attachments: [{ name: 'x.pdf', mediaType: 'application/pdf', bytes }] }] };
    const error = thrownBy(() => planReport(report));
    expect(error).toBeInstanceOf(ReportLimitError);
    expect((error as Error).message).toBe(entryMessage);
  });
  it('marks an oversized header in both planners', () => {
    const report = { ...input, projectName: 'x'.repeat(MAX_INPUT_BYTES), entries: [] };
    for (const run of [() => planReport(report), () => planReportManifest(report)]) {
      const error = thrownBy(run);
      expect(error).toBeInstanceOf(ReportLimitError);
      expect((error as Error).message).toBe(headerMessage);
    }
  });
});
