'use client';
/**
 * First-page preview of a PDF, drawn in the browser with pdf.js (loaded only when the first PDF row scrolls into view).
 * Reads through the same permission-checked route as "open"; the worker fetches only the parts it needs when the storage
 * server answers byte-range requests. Two renders at a time, results cached for the page's lifetime.
 */
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
/** A preview that failed is not retried on remount (a storage server without range support would re-download the file each time). */
const failed = new Set<string>();
let running = 0;
const waiting: (() => void)[] = [];
const MAX_PARALLEL = 2;
const THUMB_WIDTH = 160;
/** Larger PDFs keep the file-type tile: a thumbnail must never cost a long download on a phone. */
export const MAX_PDF_PREVIEW_BYTES = 12 * 1024 * 1024;

async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>(resolve => waiting.push(resolve));
  running += 1;
  try { return await work(); } finally { running -= 1; waiting.shift()?.(); }
}

async function render(url: string): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ url, disableAutoFetch: true }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally { void doc.destroy(); }
}

/** Resolves to a JPEG data URL of page 1, or rejects (the caller then shows the file-type tile). */
export function pdfThumb(url: string): Promise<string> {
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  if (failed.has(url)) return Promise.reject(new Error('preview failed'));
  const pending = inflight.get(url);
  if (pending) return pending;
  const task = slot(() => render(url)).then(data => { cache.set(url, data); return data; }, error => { failed.add(url); throw error; }).finally(() => inflight.delete(url));
  inflight.set(url, task);
  return task;
}
