import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { planReport } from '../../../../src/features/reports/logic/rendering/index';
import { prepareReport } from '../../../../src/features/reports/logic/rendering/template';
import { noisyJpeg } from '../support/artifacts';
import { input, png } from './fixtures';

const base = () => sharp({ create: { width: 80, height: 40, channels: 3, background: '#268264' } });
async function prepare(bytes: Uint8Array, mediaType = 'image/jpeg') {
  const entries = [{ ...input.entries[0], attachments: [{ name: 'photo', mediaType, bytes }] }];
  const { html, warnings } = await prepareReport(planReport({ ...input, entries })[0]);
  // The logo is WebP, so every JPEG or PNG data URL is the attachment.
  const images = [...html.matchAll(/data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)/g)].map(([, type, data]) => ({ type, data }));
  return { html, warnings, images };
}
function expectAsIs(result: Awaited<ReturnType<typeof prepare>>, bytes: Uint8Array) {
  expect(result.warnings).toEqual([]);
  expect(result.images.map(image => image.type)).toEqual(['jpeg']);
  expect(Buffer.from(result.images[0].data, 'base64').equals(Buffer.from(bytes))).toBe(true);
}

describe('embedding JPEG', () => {
  it.each([
    ['baseline', () => base().jpeg({ quality: 80 }).toBuffer()],
    ['progressive', () => base().jpeg({ progressive: true }).toBuffer()],
    ['grayscale', () => base().toColourspace('b-w').jpeg().toBuffer()],
    ['EXIF orientation 1', () => base().withMetadata({ orientation: 1 }).jpeg().toBuffer()],
    ['detailed', () => noisyJpeg(1, 320, 240)],
  ])('embeds the original bytes: %s', async (_name, create) => {
    const bytes = await create();
    expectAsIs(await prepare(bytes), bytes);
  });
  it('embeds only the view, not its backing buffer', async () => {
    const bytes = await base().jpeg().toBuffer();
    const view = new Uint8Array(Buffer.concat([Buffer.alloc(9, 1), bytes, Buffer.alloc(9, 2)])).subarray(9, 9 + bytes.length);
    expectAsIs(await prepare(view), bytes);
  });
  it.each([2, 3, 4, 5, 6, 7, 8])('turns EXIF orientation %d upright in PNG', async orientation => {
    const bytes = await base().withMetadata({ orientation }).jpeg().toBuffer();
    expect((await sharp(bytes).metadata()).orientation).toBe(orientation);
    const { images, warnings } = await prepare(bytes);
    expect(warnings).toEqual([]);
    expect(images.map(image => image.type)).toEqual(['png']);
    const { width, height } = await sharp(Buffer.from(images[0].data, 'base64')).metadata();
    expect([width, height]).toEqual(orientation >= 5 ? [40, 80] : [80, 40]);
  });

  const corrupt: [string, () => Promise<Uint8Array>][] = [
    ['garbage', async () => new Uint8Array([1, 2, 3])],
    ['empty', async () => new Uint8Array()],
    ['header only', async () => (await noisyJpeg(2, 160, 120)).subarray(0, 200)],
    ['truncated pixels', async () => { const jpeg = await noisyJpeg(2, 160, 120); return jpeg.subarray(0, jpeg.length / 2); }],
    ['truncated with an end marker', async () => {
      const jpeg = await noisyJpeg(2, 160, 120);
      return Buffer.concat([jpeg.subarray(0, jpeg.length / 2), Buffer.from([0xff, 0xd9])]);
    }],
    ['over 40 megapixels', () => sharp({ create: { width: 7000, height: 6000, channels: 3, background: '#777777' } }).jpeg({ quality: 30 }).toBuffer()],
  ];
  it.each(corrupt)('keeps the explicit warning: %s', async (_name, create) => {
    const { html, images, warnings } = await prepare(await create());
    expect(warnings).toEqual([{ entryId: 'a', attachmentName: 'photo', message: 'התמונה פגומה או לא ניתנת להצגה — לא נכללה בדוח' }]);
    expect(html).toContain(warnings[0].message);
    expect(images).toEqual([]);
  });

  it.each([
    ['PNG', async () => png],
    ['WebP', async () => base().webp().toBuffer()],
    ['SVG', async () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20"/></svg>')],
  ])('never labels %s bytes as JPEG', async (_name, create) => {
    expect((await prepare(await create())).images.map(image => image.type)).toEqual(['png']);
  });
  it.each(['image/png', 'image/webp'])('keeps converting %s to PNG', async mediaType => {
    const bytes = mediaType === 'image/png' ? png : await base().webp().toBuffer();
    expect((await prepare(bytes, mediaType)).images.map(image => image.type)).toEqual(['png']);
  });
});
