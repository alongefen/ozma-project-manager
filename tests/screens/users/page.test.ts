import { beforeEach, describe, expect, it, vi } from 'vitest';

const listUsers = vi.fn();
const listProjects = vi.fn();
const getContext = vi.fn();
vi.mock('@/components/shell/request', () => ({ getContext: () => getContext(), getPlatform: async () => ({}) }));
vi.mock('@/features/users/logic', () => ({ createUsersApi: () => ({ listUsers }) }));
vi.mock('@/features/projects/logic', () => ({ createProjectsApi: () => ({ listProjects }) }));
vi.mock('@/features/users/shared/UsersManager', () => ({ UsersManager: () => null }));
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Error(`redirect:${to}`); } }));

import UsersPage from '@/app/(app)/users/page';

const ctx = (isOwner: boolean) => ({ ok: true, value: { actor: { userId: 'u', fullName: 'x', email: 'x@example.invalid', isOwner } } });

describe('/users page', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('refuses a non-owner and reads no data', async () => {
    getContext.mockResolvedValue(ctx(false));
    const el = await UsersPage();
    expect(JSON.stringify(el.props.children)).toContain('רק מנהל המערכת');
    expect(listUsers).not.toHaveBeenCalled();
    expect(listProjects).not.toHaveBeenCalled();
  });
  it('sends a signed-out visitor to sign-in', async () => {
    getContext.mockResolvedValue({ ok: false, error: { code: 'UNAUTHENTICATED', message: '' } });
    await expect(UsersPage()).rejects.toThrow(/redirect:/);
    expect(listUsers).not.toHaveBeenCalled();
  });
  it('loads people and projects together for the owner', async () => {
    getContext.mockResolvedValue(ctx(true));
    listUsers.mockResolvedValue({ ok: true, value: [] });
    listProjects.mockResolvedValue({ ok: true, value: [] });
    const el = await UsersPage();
    const [title, manager] = el.props.children; // the desktop title row, then the manager
    expect(title.props.title).toBe('עובדים והרשאות');
    expect(manager.props.users).toEqual([]);
    expect(listProjects).toHaveBeenCalledWith(expect.anything(), { archived: false });
  });
  it('fails loudly rather than showing partial data', async () => {
    getContext.mockResolvedValue(ctx(true));
    listUsers.mockResolvedValue({ ok: false, error: { code: 'UNAVAILABLE', message: '' } });
    listProjects.mockResolvedValue({ ok: true, value: [] });
    await expect(UsersPage()).rejects.toThrow();
  });
});
