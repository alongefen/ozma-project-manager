import { describe, expect, it } from 'vitest';
import type { ProjectCard, UserRow } from '@/types/contracts';
import { addableProjects, assignmentLabel, errorText, filterUsers, sortUsers, statusLabel, validateNewPerson, validatePassword } from '@/features/users/shared/view-model';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = (n: number, over: Partial<UserRow> = {}): UserRow => ({ id: id(n), fullName: `אדם ${n}`, email: `p${n}@example.invalid`, isOwner: false, isActive: true, revision: 1, assignments: [], ...over });
const project = (n: number, over: Partial<ProjectCard> = {}): ProjectCard => ({ id: id(100 + n), name: `פרויקט ${n}`, businessName: '', siteAddress: '', status: 'active', archived: false, coverFileId: null, reportCount: 0, openTaskCount: 0, ...over });

describe('users view model', () => {
  it('sorts owner first, then active, then by name', () => {
    const rows = sortUsers([user(1, { isActive: false, fullName: 'א' }), user(2, { fullName: 'ב' }), user(3, { isOwner: true, fullName: 'ת' }), user(4, { fullName: 'א' })]);
    expect(rows.map(r => r.id)).toEqual([id(3), id(4), id(2), id(1)]);
  });
  it('searches name, email and project names locally', () => {
    const rows = [user(1, { fullName: 'דנה כהן' }), user(2, { assignments: [{ projectId: id(101), projectName: 'מגדל הים', role: 'worker', financeAccess: false, revision: 1 }] })];
    expect(filterUsers(rows, ' דנה ').map(r => r.id)).toEqual([id(1)]);
    expect(filterUsers(rows, 'מגדל').map(r => r.id)).toEqual([id(2)]);
    expect(filterUsers(rows, 'P2@EXAMPLE').map(r => r.id)).toEqual([id(2)]);
    expect(filterUsers(rows, '')).toHaveLength(2);
  });
  it('labels role per assignment and status', () => {
    expect(assignmentLabel({ projectName: 'א', role: 'manager' })).toBe('א · מנהל');
    expect(assignmentLabel({ projectName: 'א', role: 'worker' })).toBe('א · עובד');
    expect(statusLabel({ isOwner: true, isActive: true })).toBe('מנהל מערכת');
    expect(statusLabel({ isOwner: false, isActive: false })).toBe('מושבת');
  });
  it('offers only open, unassigned projects', () => {
    const list = [project(1), project(2), project(3, { status: 'completed' }), project(4, { archived: true })];
    expect(addableProjects(list, [{ projectId: id(101) }]).map(p => p.id)).toEqual([id(102)]);
  });
  it('validates a new person and a password', () => {
    expect(validateNewPerson({ fullName: ' ', email: 'x', password: '123' })).toEqual({ fullName: expect.any(String), email: expect.any(String), password: expect.any(String) });
    expect(validateNewPerson({ fullName: 'דנה', email: 'a@example.invalid', password: '12345678' })).toEqual({});
    expect(validatePassword('1234567')).toBeDefined();
    expect(validatePassword('12345678')).toBeUndefined();
  });
  it('maps errors to plain Hebrew and never leaks raw messages', () => {
    expect(errorText('CONFLICT', 'create')).toContain('אימייל');
    expect(errorText('CONFLICT')).toContain('השתנה');
    expect(errorText('WHATEVER')).toBe(errorText('UNAVAILABLE'));
  });
});

import { filterUsers as filterAll, projectOptions, EMPTY_FILTER, NO_PROJECT } from '@/features/users/shared/view-model';

const mk = (id: string, p: Partial<UserRow>): UserRow => ({ id, fullName: id, email: `${id}@x.test`, isOwner: false, isActive: true, revision: 1, assignments: [], ...p });
const asg = (projectId: string, role: 'manager' | 'worker') => ({ projectId, projectName: `P${projectId}`, role, financeAccess: false, revision: 1 });
describe('user filters', () => {
  const users = [
    mk('ben', { isOwner: true }),
    mk('a', { assignments: [asg('1', 'manager'), asg('2', 'worker')] }),
    mk('b', { assignments: [asg('1', 'worker')], isActive: false }),
    mk('c', {}),
  ];
  const ids = (f: Partial<typeof EMPTY_FILTER>) => filterAll(users, { ...EMPTY_FILTER, ...f }).map(u => u.id);
  it('by project', () => expect(ids({ projectId: '1' })).toEqual(['a', 'b']));
  it('role is checked on the chosen project', () => { expect(ids({ projectId: '2', role: 'manager' })).toEqual([]); expect(ids({ projectId: '1', role: 'manager' })).toEqual(['a']); });
  it('role on any project', () => expect(ids({ role: 'worker' })).toEqual(['a', 'b']));
  it('status', () => { expect(ids({ status: 'inactive' })).toEqual(['b']); expect(ids({ status: 'active' })).toEqual(['ben', 'a', 'c']); });
  it('no project excludes the owner', () => expect(ids({ projectId: NO_PROJECT })).toEqual(['c']));
  it('owner role', () => expect(ids({ role: 'owner' })).toEqual(['ben']));
  it('project options from assignments', () => expect(projectOptions(users).map(p => p.id)).toEqual(['1', '2']));
});
