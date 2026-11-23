import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Platform, ProjectFields, ProjectsApi, RequestContext, Result, Saved } from '../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { createProjectsApi } from '../../src/features/projects/logic';
import { rpc, fetchAll } from '../../src/lib/db/rpc';
import { permissions } from '../../src/lib/permissions';
import { format } from '../../src/lib/format';
import { cloudOwner } from '../auth/support/cloud';

const unwrap = <T>(r: Result<T>): T => { if (!r.ok) throw new Error(`fixture failed: ${r.error.code}`); return r.value; };
const runId = randomUUID();
const base: ProjectFields = { name: `P1410 ${runId}`, businessName: 'עסק בדוי בע״מ', siteAddress: 'רחוב בדיקה 1', contact: { name: 'איש קשר בדוי', phone: '0000000000', email: null, roleTitle: null }, startDate: null, endDate: null, accessNotes: null };
let ben: RequestContext, api: ProjectsApi;
const created: Saved[] = [];
beforeAll(async () => {
  ben = await cloudOwner();
  api = createProjectsApi({ rpc, fetchAll, permissions, format } as Platform);
}, 60000);

afterAll(async () => {
  for (const p of created) {
    const cur = unwrap(await api.getProject(ben, { id: p.id }));
    await rpc(ben, 'set_project_archived', { id: p.id, expectedRevision: cur.revision, archived: true });
  }
}, 60000);

async function make(suffix: string, businessNumber: string) {
  const p = unwrap(await api.createProject(ben, { requestId: randomUUID(), fields: { ...base, name: `${base.name} ${suffix}`, businessNumber } }));
  created.push(p);
  return p;
}
const number = async (id: string) => unwrap(await api.getProject(ben, { id })).businessNumber;

describe.sequential('update_project and the owner-only business number (P1.4.10 fix)', () => {
  it('keeps the stored number when the owner omits the optional field', async () => {
    const p = await make('keep', 'FAKE-1410');
    unwrap(await api.updateProject(ben, { id: p.id, expectedRevision: p.revision, fields: { ...base, name: `${base.name} keep renamed` } }));
    expect(await number(p.id)).toBe('FAKE-1410');
  });
  it('replaces the number when the owner sends a new value', async () => {
    const p = await make('replace', 'FAKE-1410');
    unwrap(await api.updateProject(ben, { id: p.id, expectedRevision: p.revision, fields: { ...base, name: `${base.name} replace`, businessNumber: 'FAKE-2' } }));
    expect(await number(p.id)).toBe('FAKE-2');
  });
  it('clears the number only on an explicit null', async () => {
    const p = await make('clear', 'FAKE-1410');
    unwrap(await api.updateProject(ben, { id: p.id, expectedRevision: p.revision, fields: { ...base, name: `${base.name} clear`, businessNumber: null } }));
    expect(await number(p.id) ?? null).toBeNull();
  });
});
