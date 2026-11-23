import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FinanceFilter, Platform, RequestContext, Saved, TransactionFields } from '@/types/contracts';
vi.mock('server-only', () => ({}));
type Jar = Map<string, string>;
const incoming = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock('next/headers', () => ({
  cookies: async () => {
    const jar = incoming.jar;
    return {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      set: (name: string, value: string) => { if (value) jar.set(name, value); else jar.delete(name); },
    };
  },
  headers: async () => new Headers(),
}));
import { GET } from '@/app/api/exports/finance/route';
import { createFinanceApi } from '@/features/finance/logic';
import { renderFinanceWorkbook } from '@/features/finance-export/logic/rendering';
import { createRequestDb } from '@/lib/db/clients';
import { fetchAll, rpc } from '@/lib/db/rpc';
import { format } from '@/lib/format';
import { permissions } from '@/lib/permissions';
import { cloudActor, cloudEnvironment, cloudOwner } from '../../../auth/support/cloud';
import { expectDenied, expectDownload, pairsAfter, sheetRows } from './support';

type Person = { ctx: RequestContext; jar: Jar };
const finance = createFinanceApi({ rpc, fetchAll, permissions, format } as Platform);
const run = randomUUID();
const formula = `=HYPERLINK("https://example.invalid","ייצוא") ${run}`;
const cancelled = `מבוטלת ייצוא ${run}`;
const otherMonth = `חודש אחר ייצוא ${run}`;
const otherDay = `יום אחר ייצוא ${run}`;
const filtered: FinanceFilter = { period: { year: 2026, month: 12 }, day: 2, search: 'ייצוא' };
let secret = '';
let ben: Person, manager: Person, plain: Person, worker: Person, outsider: Person;
let exported: Saved, mixed: Saved, unrelated: Saved;
let managerRevision: number;

// הודעת כשל נושאת קוד בלבד, בלי הקשר, עוגיות או סשן.
async function must<O>(name: string, input: unknown): Promise<O> {
  const result = await rpc<unknown, O>(ben.ctx, name, input);
  if (!result.ok) throw new Error(`הכנת הבדיקה נכשלה: ${name} ${result.error.code}`);
  return result.value;
}
async function signedIn(ctx: RequestContext): Promise<Person> {
  const { data } = await ctx.db.auth.getSession();
  if (!data.session) throw new Error('אין סשן בדיקה');
  const jar: Jar = new Map();
  const db = createRequestDb({
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: values => { for (const { name, value } of values) { if (value) jar.set(name, value); else jar.delete(name); } },
  });
  const { error } = await db.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  if (error || !jar.size) throw new Error('יצירת עוגיות בדיקה נכשלה');
  return { ctx, jar };
}
const project = (label: string) => must<Saved>('create_project', { requestId: randomUUID(), fields: {
  name: `P149 ${label} ${run}`, businessName: 'בדוי', siteAddress: 'בדיקה',
  contact: { name: 'בדוי', phone: '0', email: null, roleTitle: null }, startDate: null, endDate: null, accessNotes: null,
} });
const transaction = (projectId: string, fields: Partial<TransactionFields>) => must<Saved>('create_transaction', {
  requestId: randomUUID(), projectId, fields: { year: 2026, month: 12, day: 2, kind: 'income', amount: 100050, details: formula, ...fields },
});
async function membership(person: Person, target: Saved, role: 'manager' | 'worker', expectedRevision: number | null = null) {
  return (await must<{ revision: number }>('set_membership', { userId: person.ctx.actor.userId, projectId: target.id, role, expectedRevision })).revision;
}
async function financeAccess(person: Person, enabled: boolean, expectedRevision: number) {
  return (await must<{ revision: number }>('set_finance_access', { userId: person.ctx.actor.userId, projectId: exported.id, enabled, expectedRevision })).revision;
}
function download(jar: Jar, projectId: string, filter: FinanceFilter = { period: 'all' }) {
  const period = filter.period === 'all' ? 'all' : `${filter.period.year}-${String(filter.period.month).padStart(2, '0')}`;
  const query = new URLSearchParams({ projectId, period });
  if (filter.day !== undefined) query.set('day', String(filter.day));
  if (filter.search !== undefined) query.set('search', filter.search);
  incoming.jar = jar;
  return GET(new Request(`https://app.invalid/api/exports/finance?${query}`));
}
const allowed = async () => expectDownload(await download(manager.jar, exported.id), 'כספים-כל-התקופה.xlsx');
const denied = async () => expectDenied(await download(manager.jar, exported.id), 'NOT_FOUND');
async function expectFilteredBook(person: Person) {
  const rows = await expectDownload(await download(person.jar, exported.id, filtered), 'כספים-2026-12.xlsx');
  const book = await finance.getBook(person.ctx, { projectId: exported.id, filter: filtered });
  if (!book.ok) throw new Error(`קריאת ספר הבדיקה נכשלה: ${book.error.code}`);
  expect(rows).toEqual(await sheetRows(await renderFinanceWorkbook(book.value)));
  expect(pairsAfter(rows, 'סיכום תקופה', 2)).toEqual([['הכנסות', 3000.5], ['הוצאות', 40]]);
  expect(pairsAfter(rows, 'סיכום שורות מסוננות', 2)).toEqual([['הכנסות', 1000.5], ['הוצאות', 40]]);
  expect(rows).toContainEqual([2, 'הכנסה', formula, 1000.5]);
  for (const absent of [cancelled, otherMonth, otherDay]) expect(rows.flat()).not.toContain(absent);
}

beforeAll(async () => {
  const env = cloudEnvironment();
  secret = env.secret;
  vi.stubEnv('SUPABASE_URL', env.url);
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', env.key);
  vi.stubEnv('SUPABASE_SECRET_KEY', env.secret);
  ben = await signedIn(await cloudOwner());
  manager = await signedIn((await cloudActor(ben.ctx, 'export-manager')).ctx);
  plain = await signedIn((await cloudActor(ben.ctx, 'export-plain')).ctx);
  worker = await signedIn((await cloudActor(ben.ctx, 'export-worker')).ctx);
  outsider = await signedIn((await cloudActor(ben.ctx, 'export-outsider')).ctx);
  exported = await project('export');
  mixed = await project('mixed');
  unrelated = await project('unrelated');

  await transaction(exported.id, {});
  await transaction(exported.id, { day: 3, amount: 200000, details: otherDay });
  await transaction(exported.id, { kind: 'expense', amount: 4000, details: `הוצאה ייצוא ${run}` });
  await transaction(exported.id, { year: 2027, month: 1, amount: 500000, details: otherMonth });
  const voided = await transaction(exported.id, { amount: 77777, details: cancelled });
  await must('cancel_transaction', { id: voided.id, expectedRevision: voided.revision });
  for (const target of [mixed, unrelated]) await transaction(target.id, { amount: 918273, details: `סוד של פרויקט אחר ${run}` });

  managerRevision = await financeAccess(manager, true, await membership(manager, exported, 'manager'));
  await membership(manager, mixed, 'worker');
  await membership(plain, exported, 'manager');
  await membership(worker, exported, 'worker');
}, 180_000);
afterAll(() => { vi.unstubAllEnvs(); });

// הסדר מכוון: שלילות ההרשאה בסוף, ורק על משתמשים שהבדיקה יצרה.
describe.sequential('הורדת Excel מול ענן הפיתוח, עוגיות ו-RLS אמיתיים', () => {
  it('הבעלים מקבל ספר מסונן, ושאילתות המסד אינן עם מפתח מיוחס', async () => {
    const fetched = vi.spyOn(globalThis, 'fetch');
    try {
      await expectFilteredBook(ben);
      const data = fetched.mock.calls.filter(([url]) => String(url).includes('/rest/v1/'));
      expect(data.length > 0).toBe(true);
      expect(data.some(([, init]) => [...new Headers(init?.headers).values()].some(value => value.includes(secret)))).toBe(false);
    } finally { fetched.mockRestore(); }
  }, 60_000);

  it('מנהל עם כספים מקבל ספר מסונן, ובכל התקופה אין תנועה מבוטלת', async () => {
    await expectFilteredBook(manager);
    const rows = await allowed();
    expect(rows.flat()).toContain(otherMonth);
    expect(rows.flat()).not.toContain(cancelled);
  }, 60_000);

  it.each([
    ['עובד', () => [worker, exported] as const],
    ['מנהל ללא כספים', () => [plain, exported] as const],
    ['משתמש ללא שיוך', () => [outsider, exported] as const],
    ['מנהל עם כספים בא׳ שהוא עובד בב׳', () => [manager, mixed] as const],
    ['מנהל עם כספים בא׳ שמבקש פרויקט אחר', () => [manager, unrelated] as const],
  ])('%s נדחה', async (_label, subject) => {
    const [person, target] = subject();
    await expectDenied(await download(person.jar, target.id), 'NOT_FOUND');
  });

  it('פרויקט שאינו קיים אינו ניתן להבחנה מפרויקט אסור', async () => {
    const forbidden = await download(manager.jar, unrelated.id);
    const missing = await download(manager.jar, randomUUID());
    expect([...missing.headers]).toEqual([...forbidden.headers]);
    await expectDenied(forbidden, 'NOT_FOUND');
    await expectDenied(missing, 'NOT_FOUND');
  });

  it('בלי עוגייה ועם עוגייה שזויפה לזהות הבעלים נדחים', async () => {
    await expectDenied(await download(new Map(), exported.id), 'UNAUTHENTICATED');
    const { data } = await worker.ctx.db.auth.getSession();
    if (!data.session) throw new Error('אין סשן בדיקה לזיוף');
    const [header, payload, signature] = data.session.access_token.split('.');
    const claims = { ...JSON.parse(Buffer.from(payload, 'base64url').toString()), sub: ben.ctx.actor.userId };
    const forged = { ...data.session, access_token: `${header}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature}` };
    const name = [...worker.jar.keys()][0].replace(/\.\d+$/, '');
    const jar: Jar = new Map([[name, `base64-${Buffer.from(JSON.stringify(forged)).toString('base64url')}`]]);
    await expectDenied(await download(jar, exported.id), 'UNAUTHENTICATED');
  });

  it('מנהל עם כספים מייצא גם פרויקט שהסתיים', async () => {
    await must('set_project_status', { id: exported.id, expectedRevision: exported.revision, status: 'completed' });
    await expectFilteredBook(manager);
  }, 60_000);

  it('סגירת כספים, הורדה לעובד והסרת שיוך חלות על אותה עוגייה בבקשה הבאה', async () => {
    managerRevision = await financeAccess(manager, false, managerRevision);
    await denied();
    managerRevision = await financeAccess(manager, true, managerRevision);
    await allowed();
    managerRevision = await membership(manager, exported, 'worker', managerRevision);
    await denied();
    managerRevision = await membership(manager, exported, 'manager', managerRevision);
    managerRevision = await financeAccess(manager, true, managerRevision);
    await allowed();
    await must('remove_membership', { userId: manager.ctx.actor.userId, projectId: exported.id, expectedRevision: managerRevision });
    await denied();
  }, 120_000);

  it('סשן שנותק נדחה אף שהעוגייה הישנה נשלחת', async () => {
    managerRevision = await financeAccess(manager, true, await membership(manager, exported, 'manager'));
    await allowed();
    const stale = new Map(manager.jar);
    const { error } = await manager.ctx.db.auth.signOut({ scope: 'local' });
    expect(error === null).toBe(true);
    await expectDenied(await download(stale, exported.id), 'UNAUTHENTICATED');
  }, 60_000);

  it('משתמש שהושבת נדחה מיד, גם עם הרשאת כספים', async () => {
    // set_membership הראשון החזיר revision 1.
    await financeAccess(plain, true, 1);
    await expectDownload(await download(plain.jar, exported.id), 'כספים-כל-התקופה.xlsx');
    // complete_profile_creation מעלה revision, ולכן אין להניח שהוא 1.
    const profile = await ben.ctx.db.from('profiles').select('revision').eq('id', plain.ctx.actor.userId).single();
    if (!profile.data) throw new Error('קריאת פרופיל הבדיקה נכשלה');
    await must('set_user_active', { id: plain.ctx.actor.userId, active: false, expectedRevision: profile.data.revision });
    await expectDenied(await download(plain.jar, exported.id), 'UNAUTHENTICATED');
  }, 60_000);
});
