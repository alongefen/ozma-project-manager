import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { Platform, RequestContext } from '@/types/contracts';
import { loadFinance } from '@/features/finance/shared/load';
import { format } from '@/lib/format';

const projectId = '11111111-1111-4111-8111-111111111111';
const ctx = { actor: { userId: 'u', fullName: 'בדוי', email: 'a@example.test', isOwner: false }, db: {}, today: '2026-11-23' } as unknown as RequestContext;

// A fake platform that must never reach project data for a person without finance access.
function platform(permission: Record<string, boolean>) {
  const touched: string[] = [];
  const p = {
    format,
    permissions: { forProject: async () => ({ ok: true, value: permission }) },
    rpc: async (_c: unknown, name: string) => { touched.push(name); return { ok: true, value: [] }; },
    fetchAll: async () => { touched.push('fetchAll'); return []; },
  } as unknown as Platform;
  return { p, touched };
}

describe('מנהל בלי גישה לכספים', () => {
  it('מקבל hidden: אין סכומים ואין שליפת נתונים', async () => {
    const { p, touched } = platform({ view: true, viewFinance: false, writeFinance: false, cancelTransaction: false });
    const result = await loadFinance(p, ctx, projectId, { period: 'all' });
    expect(result).toEqual({ kind: 'hidden' });
    expect(touched).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/\d/);
  });
  it('עובד (ללא כל כספים) מקבל אותו דבר', async () => {
    const { p } = platform({ view: true, viewFinance: false, writeFinance: false, cancelTransaction: false });
    expect((await loadFinance(p, ctx, projectId, { period: { year: 2026, month: 11 } })).kind).toBe('hidden');
  });
  it('שגיאת הרשאה מהשרת גם היא hidden', async () => {
    const p = { permissions: { forProject: async () => ({ ok: false, error: { code: 'FORBIDDEN', message: 'x' } }) } } as unknown as Platform;
    expect((await loadFinance(p, ctx, projectId, { period: 'all' })).kind).toBe('hidden');
  });
  it('מזהה פרויקט שגוי הוא hidden וסשן שאבד מפנה לכניסה', async () => {
    const mk = (code: string) => ({ permissions: { forProject: async () => ({ ok: false, error: { code, message: 'x' } }) } }) as unknown as Platform;
    expect((await loadFinance(mk('VALIDATION'), ctx, 'not-a-uuid', { period: 'all' })).kind).toBe('hidden');
    expect((await loadFinance(mk('UNAUTHENTICATED'), ctx, projectId, { period: 'all' })).kind).toBe('signed-out');
  });
  it('כשל תשתית אינו hidden ואינו מציג אפסים', async () => {
    const p = { permissions: { forProject: async () => ({ ok: false, error: { code: 'UNAVAILABLE', message: 'הפעולה לא הושלמה' } }) } } as unknown as Platform;
    expect(await loadFinance(p, ctx, projectId, { period: 'all' })).toEqual({ kind: 'error', message: 'הפעולה לא הושלמה' });
  });
});
