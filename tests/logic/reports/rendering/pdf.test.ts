import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { planReport, renderReportPart } from '../../../../src/features/reports/logic/rendering/index';
import { attachmentPdf, input, png } from './fixtures';

// CI Linux always exercises the packaged binary. On macOS set an explicit local
// Chrome path; an absent local browser is reported as a skip, never Linux evidence.
const executablePath = process.env.REPORT_TEST_CHROME;
const available = process.platform === 'linux' || Boolean(executablePath);
const options = executablePath ? { executablePath } : undefined;

describe.skipIf(!available)('real Chromium PDF rendering', () => {
  it('renders all long-report content and appends PDFs in report order', async () => {
    const firstAttachment = await attachmentPdf(241);
    const secondAttachment = await attachmentPdf(242);
    const firstOriginal = Uint8Array.from(firstAttachment);
    const text = Array.from({ length: 160 }, (_, i) => `שורה ${String(i + 1).padStart(3, '0')} — עברית עם English ו־123.45 — LINE_${String(i + 1).padStart(3, '0')}`).join('\n');
    const entries = [
      { ...input.entries[0], id: 'later', workDate: '2026-01-03', text: 'דיווח שני\n' + 'ABCDEFGHIJ'.repeat(40), attachments: [{ name: 'second.pdf', mediaType: 'application/pdf', bytes: secondAttachment }] },
      { ...input.entries[0], text, editedAt: '2026-01-04T10:00:00Z', attachments: [
        { name: 'image.png', mediaType: 'image/png', bytes: png },
        { name: 'first.pdf', mediaType: 'application/pdf', bytes: firstAttachment },
        { name: 'broken.pdf', mediaType: 'application/pdf', bytes: new Uint8Array([1, 2]) },
        { name: 'locked.pdf', mediaType: 'application/pdf', bytes: await attachmentPdf(240, true) },
        { name: 'unconverted.heic', mediaType: 'image/heic', bytes: new Uint8Array([1, 2]) },
      ] },
    ];
    const result = await renderReportPart(planReport({ ...input, entries })[0], options);
    expect(Buffer.from(result.bytes).subarray(0, 5).toString()).toBe('%PDF-');
    expect(result.warnings).toHaveLength(3);
    const pdf = await PDFDocument.load(result.bytes);
    const pages = pdf.getPages();
    expect(pages.length).toBeGreaterThanOrEqual(6);
    expect(pages.slice(-2).map(p => p.getWidth())).toEqual([241, 242]);
    expect(firstAttachment).toEqual(firstOriginal);
    if (process.env.REPORT_TEST_OUTPUT) {
      await mkdir(process.env.REPORT_TEST_OUTPUT, { recursive: true });
      await writeFile(join(process.env.REPORT_TEST_OUTPUT, 'sample-160-lines.pdf'), result.bytes);
    }
  }, 120_000);
  it('renders a real empty-day PDF', async () => {
    const result = await renderReportPart(planReport({ ...input, entries: [], scope: { kind: 'day', date: '2026-01-02' } })[0], options);
    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(1);
    expect(result.warnings).toEqual([]);
  }, 60_000);
});
