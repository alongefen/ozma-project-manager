import { describe, expect, it, vi } from 'vitest';
import type { Db, Platform, RequestContext } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { createBulkAccessCommand } from '../../../src/features/users/logic/commands';
import { fetchAll } from '../../../src/lib/db/rpc';

const userId = '711795f0-48c2-4c8f-b470-dd0c95a2aaf7';
const p = (n: number) => `95820c6e-e329-4c37-a6a3-cd4d391be7${String(n).padStart(2, '0')}`;
const tables: Record<string, unknown> = {};
const db = { from: vi.fn((table: string) => {
  const q: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'is', 'order', 'range']) q[name] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => ({ data: tables[table], error: null }));
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: tables[table], error: null }).then(resolve);
  return q;
}) } as unknown as Db;
const ctx = { actor: { userId: 'o', fullName: 'בעלים', email: 'o@example.invalid', isOwner: true }, db, today: '2026-11-25' } as RequestContext;
const run = (rpc: ReturnType<typeof vi.fn>, owner = true) => {
  const requireOwner = vi.fn(async () => owner ? ({ ok: true as const, value: null }) : ({ ok: false as const, error: { code: 'FORBIDDEN' as const, message: 'x' } }));
  const platform = { rpc, fetchAll, permissions: { requireOwner } } as unknown as Platform;
  return createBulkAccessCommand(platform).addToAllProjects(ctx, { userId, role: 'worker' });
};

describe('addToAllProjects', () => {
  it('adds only the projects the person is not in, once each, with no finance flag, and counts the result', async () => {
    tables.profiles = { is_owner: false, is_active: true };
    tables.projects = [{ id: p(1) }, { id: p(2) }, { id: p(3) }];
    tables.memberships = [{ project_id: p(2) }];
    const rpc = vi.fn(async (_c: unknown, _n: string, input: { projectId: string }) => input.projectId === p(3) ? ({ ok: false, error: { code: 'FORBIDDEN', message: 'x' } }) : ({ ok: true, value: { revision: 1, financeAccess: false } }));
    expect(await run(rpc)).toEqual({ ok: true, value: { added: 1, alreadyMember: 1, failed: 1 } });
    expect(rpc.mock.calls.map(c => c[2])).toEqual([
      { userId, projectId: p(1), role: 'worker', expectedRevision: null },
      { userId, projectId: p(3), role: 'worker', expectedRevision: null },
    ]);
  });
  it('refuses a non-owner before any write', async () => {
    const rpc = vi.fn();
    expect(await run(rpc, false)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('refuses an owner-level or inactive target', async () => {
    const rpc = vi.fn();
    tables.profiles = { is_owner: true, is_active: true };
    expect(await run(rpc)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    tables.profiles = { is_owner: false, is_active: false };
    expect(await run(rpc)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(rpc).not.toHaveBeenCalled();
  });
});
