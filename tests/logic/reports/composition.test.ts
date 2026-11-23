import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
vi.mock('server-only', () => ({}));
import { createReportsApi } from '../../../src/features/reports/logic/service';
import { buildReportHtml, renderReportPart, type ReportPart, type ReportWarning } from '../../../src/features/reports/logic/rendering/index';
import { inspectPdf, must, noisyJpeg, pdfWithPages, readArtifact } from './support/artifacts';
import { createWorld, projectA, projectName, reporterName, type World } from './support/fakes';

// Same rule as rendering/pdf.test.ts: always the packaged binary on Linux CI, an explicit local
// Chrome on macOS, otherwise a reported skip.
const executablePath = process.env.REPORT_TEST_CHROME;
const available = process.platform === 'linux' || Boolean(executablePath);
const date = '2026-11-18';
const day = { kind: 'day', projectId: projectA, date } as const;

function compose(world: World) {
  const rendered: { part: ReportPart; warnings: ReportWarning[] }[] = [];
  const render: typeof renderReportPart = async part => {
    const result = await renderReportPart(part, executablePath ? { executablePath } : undefined);
    rendered.push({ part, warnings: result.warnings });
    return result;
  };
  return { api: createReportsApi(world.platform, { diary: world.diary, render }), rendered };
}

describe.skipIf(!available)('ReportsApi composed with the real engine and Chromium', () => {
  it('produces Hebrew content, an image and the attached PDF pages in report order', async () => {
    const world = createWorld();
    const display = await sharp({ create: { width: 800, height: 500, channels: 3, background: '#268264' } }).jpeg({ quality: 80 }).toBuffer();
    // The later entry is stored first, so the appended order can only come from the report order.
    world.addEntry({ workDate: '2026-11-19', body: 'דיווח מאוחר', files: [world.addFile('application/pdf', { original: await pdfWithPages(243) })] });
    world.addEntry({
      body: 'יציקה בקומה 3', editedAt: '2026-11-19T09:30:00Z',
      files: [
        world.addFile('application/pdf', { original: await pdfWithPages(241, 242), name: 'תוכנית.pdf' }),
        world.addFile('image/heic', { display, name: 'צילום.heic' }),
        world.addFile('image/heic', { displayState: 'failed', name: 'לא הומר.heic' }),
      ],
    });
    const { api, rendered } = compose(world);
    const artifact = must(await api.renderReportPart(world.ctx, {
      scope: { kind: 'range', projectId: projectA, from: '2026-11-01', to: '2026-11-22' }, part: 1,
    }));
    const { bytes } = await readArtifact(artifact);

    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    const pdf = await inspectPdf(bytes);
    expect(pdf.title).toBe(`יומן עבודה — ${projectName}`);
    expect(pdf.fonts.some(font => font.includes('NotoSansHebrew'))).toBe(true);
    expect(pdf.images).toContainEqual(expect.objectContaining({ width: 800, height: 500 }));
    expect(pdf.widths.length).toBeGreaterThan(3);
    expect(pdf.widths.slice(-3)).toEqual([241, 242, 243]);

    const html = await buildReportHtml(rendered[0].part);
    for (const text of [projectName, reporterName, 'יציקה בקומה 3', '18.11.2026', '10:00:00', '11:30:00', 'ימי עבודה: 2']) {
      expect(html).toContain(text);
    }
    expect(html).toContain(display.toString('base64'));
    expect(rendered[0].warnings.map(warning => warning.attachmentName)).toEqual(['לא הומר.heic']);
  }, 120_000);

  it('produces a real empty day', async () => {
    const world = createWorld();
    const { api, rendered } = compose(world);
    const pdf = await inspectPdf((await readArtifact(must(await api.renderReportPart(world.ctx, { scope: day, part: 1 })))).bytes);
    expect(pdf.widths).toHaveLength(1);
    expect(pdf.title).toContain(projectName);
    expect(await buildReportHtml(rendered[0].part)).toContain('אין דיווחים');
  }, 60_000);

  // Converted to PNG these were a ~160MiB HTML message, over Chromium's ~100MiB CDP limit.
  it('renders twenty distinct, very detailed display copies in one entry', async () => {
    const world = createWorld();
    const copies: Buffer[] = [];
    for (let seed = 1; seed <= 20; seed++) copies.push(await noisyJpeg(seed));
    world.addEntry({ files: copies.map(display => world.addFile('image/jpeg', { display })) });
    const { api, rendered } = compose(world);
    const artifact = must(await api.renderReportPart(world.ctx, { scope: day, part: 1 }));
    const pdf = await inspectPdf((await readArtifact(artifact)).bytes);
    expect(pdf.images.filter(image => image.width === 1600 && image.height === 1600)).toHaveLength(20);
    expect(rendered[0].warnings).toEqual([]);
  }, 240_000);
});
