import { test, expect, type Page } from '@playwright/test';
import type { DiaryScreen } from '@/features/diary/shared/types';
import type { DiaryRow } from '@/types/contracts';
import type { fixture } from './browser/fixture';
declare global { interface Window { fixture: typeof fixture } }
const count = (page: Page) => page.locator('.dr:visible .dr-work-days');
const ok = (workDays: number) => ({ ok: true, value: { workDays, reportCount: 80, byProject: [] } });
async function authoritative(page: Page) {
  await page.route('**/fixture/summary', async route => {
    const input = route.request().postDataJSON();
    const days = await page.evaluate(filter => new Set(window.fixture.entries.filter(r => r.projectId === filter.projectId && !r.cancelledAt && (!filter.from || r.workDate >= filter.from) && (!filter.to || r.workDate <= filter.to)).map(r => r.workDate)).size, input);
    await route.fulfill({ json: ok(days) });
  });
}
async function save(page: Page, entry: Partial<DiaryRow> & { id: string }) {
  await page.evaluate(over => {
    const f = window.fixture;
    const existing = f.entries.find(r => r.id === over.id);
    const row = { ...f.entries[0], ...existing, ...over };
    f.entries = [...f.entries.filter(r => r.id !== over.id), row]; f.savedId = row.id;
  }, entry);
  await page.getByRole('link', { name: 'דיווח חדש בטלפון' }).click();
  await page.getByRole('button', { name: 'שמירה מדומה' }).click();
}
async function setScreen(page: Page, over: Partial<DiaryScreen>) { await page.evaluate(async over => { window.fixture.setScreen(over); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); }, over); }

test.beforeEach(async ({ page }) => { page.on('pageerror', e => console.log('PAGE ERROR', e.stack)); page.on('console', m => { if (m.type() === 'error') console.log('BROWSER', m.text()); }); await page.route('**/fixture/cancel', route => route.fulfill({ json: { ok: true } })); await authoritative(page); await page.goto('/'); await expect(count(page)).toHaveText('ימי עבודה שדווחו: 1'); });

test('refresh after saves: second report on a date, new date, date move, project move', async ({ page }) => {
  await save(page, { id: 'second', workDate: '2026-11-25' });
  await expect(count(page)).toHaveText('ימי עבודה שדווחו: 1');
  await save(page, { id: 'third', workDate: '2026-11-26' });
  await expect(count(page)).toHaveText('ימי עבודה שדווחו: 2');
  await save(page, { id: 'third', workDate: '2026-11-24' });
  await expect(count(page)).toHaveText('ימי עבודה שדווחו: 2');
  await save(page, { id: 'third', projectId: '22222222-2222-4222-8222-222222222222' });
  await expect(count(page)).toHaveText('ימי עבודה שדווחו: 1');
  await expect(page.locator('.dr:visible')).not.toContainText('דיווח לדוגמה third');
});

test('cancel one report leaves an unloaded same-day report; last report removes the day', async ({ page }) => {
  await page.locator('.dr:visible').getByRole('button', { name: 'ביטול הדיווח', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'ביטול הדיווח', exact: true }).click();
  await expect(page.locator('.dr:visible')).toContainText('אין דיווחים להצגה');
  await expect(count(page)).toHaveText('ימי עבודה שדווחו: 1');
  await setScreen(page, { rows: [await page.evaluate(() => window.fixture.entries[0])], nextCursor: null });
  await page.locator('.dr:visible').getByRole('button', { name: 'ביטול הדיווח', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'ביטול הדיווח', exact: true }).click();
  await expect(count(page)).toHaveText('ימי עבודה שדווחו: 0');
});

test('loading hides stale value, refresh failure is not zero, and recovery works', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(r => { release = r; });
  await page.route('**/fixture/summary', async route => { await pending; await route.fulfill({ json: { ok: false, error: { code: 'UNAVAILABLE', message: 'failure' } } }); });
  await save(page, { id: 'third', workDate: '2026-11-26' });
  await expect(count(page)).toHaveAttribute('aria-busy', 'true');
  await expect(count(page)).not.toContainText('1');
  release();
  await expect(count(page)).toContainText('מספר ימי העבודה אינו זמין כרגע');
  await page.unroute('**/fixture/summary'); await authoritative(page);
  await save(page, { id: 'third', body: 'תיקון' });
  await expect(count(page)).toHaveText('ימי עבודה שדווחו: 2');
});

test('old filter response cannot overwrite a newer server screen', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(r => { release = r; });
  await page.route('**/fixture/summary', async route => { await pending; await route.fulfill({ json: ok(99) }); });
  await save(page, { id: 'third', workDate: '2026-11-26' });
  await setScreen(page, { filter: { projectId: '11111111-1111-4111-8111-111111111111', from: '2026-11-26' }, workDays: { status: 'ready', count: 7 }, rows: [] });
  release();
  await expect(count(page)).toHaveText('ימי עבודה שדווחו: 7');
});

for (const width of [360, 375, 390, 768, 1024, 1280]) {
  test(`Hebrew RTL at ${width}: count, zero, error outside Pin, no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const state of [{ status: 'ready', count: 12 }, { status: 'ready', count: 0 }, { status: 'error' }] as const) {
      await setScreen(page, { workDays: state });
      await expect(count(page)).toContainText(state.status === 'error' ? 'מספר ימי העבודה אינו זמין כרגע' : `ימי עבודה שדווחו: ${state.count}`);
      expect(await count(page).evaluate(el => el.closest('.ui-pin'))).toBeNull();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await count(page).evaluate(el => getComputedStyle(el).direction)).toBe('rtl');
    }
  });
}

test('latest mutation wins when aggregate requests finish out of order', async ({ page }) => {
  let releaseFirst!: () => void;
  const pending = new Promise<void>(r => { releaseFirst = r; });
  let requests = 0;
  await page.route('**/fixture/summary', async route => {
    const n = ++requests;
    if (n === 1) await pending;
    await route.fulfill({ json: ok(n === 1 ? 99 : 3) });
  });
  await save(page, { id: 'third', workDate: '2026-11-26' });
  await expect.poll(() => requests).toBe(1);
  await save(page, { id: 'fourth', workDate: '2026-11-24' });
  await expect(count(page)).toHaveText('ימי עבודה שדווחו: 3');
  const response = page.waitForResponse(r => r.url().endsWith('/fixture/summary'));
  releaseFirst(); await response;
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(count(page)).toHaveText('ימי עבודה שדווחו: 3');
});

test('refresh uses current exact bounds; pagination does not change the aggregate or close a form', async ({ page }) => {
  const filter = { projectId: '11111111-1111-4111-8111-111111111111', from: '2026-11-26', to: '2026-11-26' };
  await setScreen(page, { filter, workDays: { status: 'ready', count: 0 } });
  const request = page.waitForRequest(r => r.url().endsWith('/fixture/summary'));
  await save(page, { id: 'third', workDate: '2026-11-26' });
  expect((await request).postDataJSON()).toEqual(filter);
  await expect(count(page)).toHaveText('ימי עבודה שדווחו: 1');
  await page.locator('.dr:visible').getByRole('button', { name: 'טעינת דיווחים נוספים' }).click();
  await expect(count(page)).toHaveText('ימי עבודה שדווחו: 1');
  await page.getByRole('link', { name: 'דיווח חדש בטלפון' }).click();
  await expect(page.getByRole('dialog', { name: 'דיווח חדש', exact: true })).toBeVisible();
});

test('general diary saves do not request summary, and transport failure shows unavailable', async ({ page }) => {
  await setScreen(page, { fixedProjectId: undefined, workDays: undefined });
  let requested = false;
  await page.route('**/fixture/summary', async route => { requested = true; await route.abort(); });
  await save(page, { id: 'third', workDate: '2026-11-26' });
  await expect(page.locator('.dr-work-days')).toHaveCount(0);
  expect(requested).toBe(false);
  await setScreen(page, { fixedProjectId: '11111111-1111-4111-8111-111111111111', workDays: { status: 'ready', count: 1 } });
  await save(page, { id: 'third', workDate: '2026-11-26' });
  await expect(count(page)).toContainText('מספר ימי העבודה אינו זמין כרגע');
});

test('cancellation finishing after a filter change refreshes the current range', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(r => { release = r; });
  await page.route('**/fixture/cancel', async route => { await pending; await route.fulfill({ json: { ok: true } }); });
  await page.locator('.dr:visible').getByRole('button', { name: 'ביטול הדיווח', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'ביטול הדיווח', exact: true }).click();
  await page.evaluate(() => { window.fixture.entries = window.fixture.entries.filter(r => r.id !== 'unloaded'); });
  await setScreen(page, { filter: { projectId: '11111111-1111-4111-8111-111111111111', from: '2026-11-25' }, workDays: { status: 'ready', count: 1 } });
  release();
  await expect(count(page)).toHaveText('ימי עבודה שדווחו: 0');
});
