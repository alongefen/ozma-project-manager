import { createCipheriv } from 'node:crypto';
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from '@cantoo/pdf-lib';
import sharp from 'sharp';
import type { BinaryArtifact, Result } from '../../../../src/types/contracts';

export function must<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`);
  return result.value;
}

export async function readArtifact(artifact: BinaryArtifact): Promise<{ bytes: Buffer; chunkSizes: number[] }> {
  const reader = artifact.stream.getReader();
  const chunks: Buffer[] = [];
  for (let next = await reader.read(); !next.done; next = await reader.read()) chunks.push(Buffer.from(next.value));
  return { bytes: Buffer.concat(chunks), chunkSizes: chunks.map(chunk => chunk.length) };
}

/** Structural facts of a PDF, without a text-extraction dependency. */
export async function inspectPdf(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const images: { width: number; height: number; filter: string }[] = [];
  const fonts: string[] = [];
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    const dict = object instanceof PDFRawStream ? object.dict : object instanceof PDFDict ? object : undefined;
    if (!dict) continue;
    const get = (key: string) => String(dict.get(PDFName.of(key)));
    if (get('Subtype') === '/Image') images.push({ width: Number(get('Width')), height: Number(get('Height')), filter: get('Filter') });
    // Chromium writes a variable web font as Type 3, which names itself in its descriptor only.
    for (const key of ['BaseFont', 'FontName']) if (dict.has(PDFName.of(key))) fonts.push(get(key));
  }
  return { title: pdf.getTitle(), widths: pdf.getPages().map(page => page.getWidth()), images, fonts };
}

export async function pdfWithPages(...widths: number[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const width of widths) pdf.addPage([width, 300]).drawText('Synthetic attachment', { x: 20, y: 260, size: 14 });
  return pdf.save();
}

/**
 * Random colour noise is close to the largest file a display copy can be. AES-CTR with a fixed key
 * gives the same pixels on every machine, quickly.
 */
export async function noisyJpeg(seed: number, width = 1600, height = 1600): Promise<Buffer> {
  const pixels = createCipheriv('aes-256-ctr', Buffer.alloc(32, seed), Buffer.alloc(16)).update(Buffer.alloc(width * height * 3));
  return sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 80 }).toBuffer();
}
