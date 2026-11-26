import { test, expect, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Run without a Next server, auth, env files or cloud data:
// playwright test --config=/tmp/ozma-upload.playwright.config.ts
// The config sets testDir to this directory, testMatch to this file, workers: 1,
// and uses Chromium. UPLOAD_SELECTION_BASELINE=1 loads the actual #158 component.
// Clearing the live FileList before snapshotting must make the selection tests fail.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const projectId = '11111111-1111-4111-8111-111111111111';
const photo = { name: 'synthetic.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([255, 216, 255, 224, 0, 1, 2, 3]) };
let server: ViteDevServer;
let origin: string;

test.beforeAll(async () => {
  server = await createServer({
    root, configFile: false, envDir: false,
    resolve: { alias: { '@': `${root}src` } },
    oxc: { jsx: { runtime: 'automatic' } },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'isolated-upload-consumers',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'virtual:upload-harness') return '\0upload-harness';
        if (id === 'next/navigation') return '\0router';
        if (id === 'next/link') return '\0link';
        if (id === '../logic/actions') return '\0actions';
      },
      load(id) {
        if (id === '\0link') return `import { createElement } from 'react'; export default function Link(props) { return createElement('a', props); }`;
        if (id === '\0router') return `
          export const useRouter = () => ({ refresh() {} });
          export const useParams = () => ({});
          export const usePathname = () => '/harness';
          export const useSearchParams = () => new URLSearchParams();
        `;
        if (id === '\0actions') return `
          export async function setProjectCover(input) { window.coverInput = input; return { ok: true, value: { revision: 2 } }; }
          export async function createEntry(input) { window.diaryInput = input; return { ok: true, value: { id: 'saved' } }; }
          export const correctEntry = createEntry, moveEntry = createEntry;
          export async function listVersions() { return { ok: true, value: [] }; }
        `;
        if (id === '\0upload-harness') return `
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import { FileUpload } from '@/components/upload/FileUpload';
          import { UploadForm } from '@/features/files/shared/UploadForm';
          import { EntryForm } from '@/features/diary/shared/EntryForm';
          import { CoverControl } from '@/features/projects/shared/CoverControl';
          import '@/styles/app.css';
          import '@/features/files/shared/files.css';
          import '@/features/diary/shared/diary.css';
          const h = React.createElement;
          const uploaded = files => { window.uploaded = [...(window.uploaded || []), ...files]; };
          const mode = new URLSearchParams(location.search).get('consumer');
          const props = { projectId: '${projectId}', onUploaded: uploaded };
          const view = mode === 'document' ? h(UploadForm, { ...props, initialCategory: null, candidates: [], pending: [], busy: false, error: null, onSave() {}, onClose() {} })
            : mode === 'diary' ? h(EntryForm, { projects: [{ id: '${projectId}', name: 'פרויקט בדיקה' }], canMove: true, today: '2026-11-26', onDone() {}, onCancel() {} })
            : mode === 'cover' ? h(CoverControl, { id: '${projectId}', revision: 1, coverFileId: null })
            : h(FileUpload, { ...props, purpose: 'diary', camera: true });
          createRoot(document.getElementById('root')).render(view);
        `;
      },
      transform(_code, id) {
        if (process.env.UPLOAD_SELECTION_BASELINE && id.endsWith('/src/components/upload/FileUpload.tsx')) {
          return execFileSync('git', ['show', 'ac63c7e:src/components/upload/FileUpload.tsx'], { cwd: root, encoding: 'utf8' });
        }
      },
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith('/harness')) return next();
          res.setHeader('Content-Type', 'text/html');
          res.end('<!doctype html><html lang="he" dir="rtl"><meta name="viewport" content="width=device-width, initial-scale=1"><style>.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}</style><body style="margin:16px"><div id="root"></div><script type="module" src="/@id/__x00__upload-harness"></script></body></html>');
        });
      },
    }],
  });
  await server.listen();
  origin = server.resolvedUrls!.local[0].replace(/\/$/, '');
});
test.afterAll(async () => { await server?.close(); });

type UploadRequest = { purpose: string; projectId: string; files: { clientId: string; name: string; mime: string; sizeBytes: number }[] };
async function fixture(page: Page, consumer = 'shared', options: { beginError?: boolean; completeError?: boolean; hold?: boolean } = {}) {
  page.on('pageerror', error => console.error('Harness page error:', error.message));
  const begun: UploadRequest[] = [];
  const bytes: Buffer[] = [];
  const refs: Record<string, { id: string; name: string; mime: string; sizeBytes: number; displayState: string }> = {};
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/api/storage/uploads') {
      const body = request.postDataJSON() as UploadRequest;
      begun.push(body);
      if (options.beginError) return route.fulfill({ status: 503, contentType: 'text/html', body: 'synthetic failure' });
      const value = body.files.map((f, index) => {
        const id = `${begun.length}-${index}`;
        refs[id] = { id, name: f.name, mime: f.mime, sizeBytes: f.sizeBytes, displayState: 'none' };
        return { clientId: f.clientId, target: { ok: true, value: { fileId: id, endpoint: `${origin}/tus/${id}`, bucket: 'synthetic', path: id, publishableKey: 'fake', token: 'fake' } } };
      });
      return route.fulfill({ json: { ok: true, value } });
    }
    if (url.pathname.startsWith('/tus/')) {
      if (request.method() === 'POST') return route.fulfill({ status: 201, headers: { Location: `${url.pathname}/data`, 'Tus-Resumable': '1.0.0' } });
      if (request.method() === 'PATCH') {
        bytes.push(request.postDataBuffer()!);
        if (options.hold) await gate;
        return route.fulfill({ status: 204, headers: { 'Upload-Offset': String(request.postDataBuffer()!.length), 'Tus-Resumable': '1.0.0' } });
      }
    }
    if (url.pathname.endsWith('/complete')) {
      const id = url.pathname.split('/').at(-2)!;
      return route.fulfill({ json: options.completeError ? { ok: false, error: { code: 'VALIDATION', message: 'synthetic' } } : { ok: true, value: refs[id] } });
    }
    if (url.pathname.startsWith('/api/')) return route.abort();
    return route.continue();
  });
  await page.goto(`${origin}/harness?consumer=${consumer}`);
  await expect(page.locator('input[type=file]').first()).toBeAttached();
  return { begun, bytes, release };
}

for (const width of [390, 1280]) {
  test.describe(`selection at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, locale: 'he-IL' });
    test('picker snapshots multiple original files and allows selecting the same file again', async ({ page }) => {
      const { begun, bytes } = await fixture(page);
      const chooser = page.waitForEvent('filechooser');
      await page.locator('button').filter({ hasText: 'בחירת קבצים' }).click();
      await (await chooser).setFiles([photo, { ...photo, name: 'second.jpg' }]);
      await expect(page.locator('.upload__item--done')).toHaveCount(2);
      expect(begun[0]).toMatchObject({ purpose: 'diary', projectId, files: [{ name: 'synthetic.jpg', mime: 'image/jpeg', sizeBytes: 8 }, { name: 'second.jpg', mime: 'image/jpeg', sizeBytes: 8 }] });
      expect(bytes).toEqual([photo.buffer, photo.buffer]);
      await expect(page.locator('input[type=file]').first()).toHaveValue('');
      await page.locator('input[type=file]').first().setInputFiles(photo);
      await expect(page.locator('.upload__item--done')).toHaveCount(3);
      expect(begun).toHaveLength(2);
      expect(await page.evaluate(() => (window as unknown as { uploaded: unknown[] }).uploaded.length)).toBe(3);
    });

    test('camera selection starts upload; cancelling selection adds no request', async ({ page }) => {
      const { begun } = await fixture(page);
      await page.locator('input[type=file]').first().setInputFiles([]);
      await page.locator('input[capture]').setInputFiles([]);
      const chooser = page.waitForEvent('filechooser');
      await page.locator('button').filter({ hasText: /^צילום$/ }).click();
      const camera = await chooser;
      expect(camera.isMultiple()).toBe(false);
      await camera.setFiles(photo);
      await expect(page.locator('.upload__item--done')).toHaveCount(1);
      expect(begun).toHaveLength(1);
      await page.locator('input[capture]').setInputFiles([]);
      await expect(page.locator('.upload__item')).toHaveCount(1);
      expect(begun).toHaveLength(1);
    });

    for (const consumer of ['document', 'diary', 'cover']) {
      test(`${consumer} consumer starts upload and receives the result`, async ({ page }) => {
        const { begun } = await fixture(page, consumer);
        if (consumer === 'document') {
          await expect(page.locator('button').filter({ hasText: 'בחירת קבצים' })).toBeDisabled();
          await page.getByRole('radio', { name: 'מפרט', exact: true }).check();
          await page.getByRole('radio', { name: /אדמינים בלבד/ }).check();
        }
        if (consumer === 'diary') await page.getByLabel('מה בוצע').fill('דיווח בדיקה');
        await page.locator('input[type=file]').first().setInputFiles(photo);
        await expect(page.locator('.upload__item--done')).toHaveCount(1);
        expect(begun[0].purpose).toBe(consumer);
        if (consumer === 'document') expect(await page.evaluate(() => (window as unknown as { uploaded: unknown[] }).uploaded.length)).toBe(1);
        if (consumer === 'cover') {
          await expect(page.getByText('תמונת השער נשמרה')).toBeVisible();
          expect(await page.evaluate(() => (window as unknown as { coverInput: unknown }).coverInput)).toMatchObject({ id: projectId, fileId: '1-0', expectedRevision: 1 });
        }
        if (consumer === 'diary') {
          await expect(page.getByRole('button', { name: 'שמירת הדיווח', exact: true })).toBeEnabled();
          await page.getByRole('button', { name: 'שמירת הדיווח', exact: true }).click();
          expect(await page.evaluate(() => (window as unknown as { diaryInput: unknown }).diaryInput)).toMatchObject({ projectId, fileIds: ['1-0'] });
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      });
    }
  });
}

test('visible progress locks diary submit until completion', async ({ page }) => {
  const { release } = await fixture(page, 'diary', { hold: true });
  await page.locator('input[type=file]').first().setInputFiles(photo);
  await expect(page.getByText(/מעלה \d+%/)).toBeVisible();
  await expect(page.locator('.upload__bar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'מעלה קבצים…', exact: true })).toBeDisabled();
  release();
  await expect(page.locator('.upload__item--done')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'שמירת הדיווח', exact: true })).toBeEnabled();
});

for (const failure of ['begin', 'complete', 'read']) {
  test(`${failure} failure displays an error instead of silently dropping the file`, async ({ page }) => {
    const { begun } = await fixture(page, 'shared', { beginError: failure === 'begin', completeError: failure === 'complete' });
    if (failure === 'read') await page.evaluate(() => { Blob.prototype.arrayBuffer = async () => { throw new Error('synthetic unreadable file'); }; });
    await page.locator('input[type=file]').first().setInputFiles(photo);
    await expect(page.locator('.upload__item--error')).toHaveCount(1);
    await expect(page.getByText(failure === 'begin' ? /השרת לא הצליח/ : failure === 'complete' ? /הקובץ לא עבר בדיקה/ : /לא ניתן לקרוא את הקובץ/)).toBeVisible();
    expect(begun).toHaveLength(failure === 'read' ? 0 : 1);
    if (failure !== 'read') await expect(page.getByRole('button', { name: /^ניסיון חוזר ל/ })).toBeVisible();
  });
}
