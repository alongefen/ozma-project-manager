import { describe, expect, it } from 'vitest';
import { buildReportHtml, planReport } from '../../../../src/features/reports/logic/rendering/index';
import { attachmentPdf, input, png } from './fixtures';

describe('shared Hebrew report template', () => {
  it('preserves all 160 lines and escapes active markup', async () => {
    const lines = Array.from({ length: 160 }, (_, i) => `שורה ${i + 1} English 123`);
    const html = await buildReportHtml(planReport({ ...input, entries: [{ ...input.entries[0], text: lines.join('\n') + '\n<script>alert(1)</script><img src="https://example.com">', editedAt: '2026-01-04T09:00:00Z' }] })[0]);
    for (const line of lines) expect(html).toContain(line);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src="https://');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="he"');
    expect(html).toContain('@font-face');
    expect(html).toContain('base64,');
    expect(html).toMatch(/bdi|unicode-bidi/);
    expect(html).toContain('בודק בדוי');
    expect(html).toContain('פרויקט בדיקה');
    expect(html).toMatch(/נערך/);
  });
  it('states that an empty day has no reports', async () => {
    const html = await buildReportHtml(planReport({ ...input, entries: [], scope: { kind: 'day', date: '2026-01-02' } })[0]);
    expect(html).toContain('אין דיווחים');
    expect(html).toMatch(/2026|26/);
  });
  it('embeds image bytes and explicitly identifies every unavailable attachment', async () => {
    const attachments = [
      { name: 'image.png', mediaType: 'image/png', bytes: png },
      { name: 'broken.pdf', mediaType: 'application/pdf', bytes: new Uint8Array([1, 2, 3]) },
      { name: 'locked.pdf', mediaType: 'application/pdf', bytes: await attachmentPdf(240, true) },
      { name: 'unconverted.heic', mediaType: 'image/heic', bytes: new Uint8Array([1, 2]) },
      { name: 'bad.png', mediaType: 'image/png', bytes: new Uint8Array([1, 2]) },
    ];
    const html = await buildReportHtml(planReport({ ...input, entries: [{ ...input.entries[0], attachments }] })[0]);
    expect(html).toContain('data:image/png;base64,');
    for (const name of ['broken.pdf', 'locked.pdf', 'unconverted.heic', 'bad.png']) expect(html).toContain(name);
    expect(html).toMatch(/מוצפן/);
  });
});
