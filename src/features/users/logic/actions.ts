'use server';
import type { UsersApi, Result, RequestContext } from '@/types/contracts';
import { UsersApiInputSchemas } from '@/types/contracts/schemas';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { createUsersApi } from './index';
import { AddToAllProjectsSchema, SetOwnerLevelSchema, SetTechnicalAdminSchema, createBulkAccessCommand, createOwnerLevelCommand, createTechnicalAdminCommand, type AddToAllProjectsInput, type AddToAllProjectsResult, type SetOwnerLevelInput, type SetTechnicalAdminInput } from './commands';

type Input<K extends keyof UsersApi> = Parameters<UsersApi[K]>[1];
type Output<K extends keyof UsersApi> = Awaited<ReturnType<UsersApi[K]>>;
async function invoke<K extends keyof UsersApi>(method: K, input: Input<K>): Promise<Output<K>> {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return context as Output<K>;
    const parsed = UsersApiInputSchemas[method].safeParse(input);
    if (!parsed.success) return failure('VALIDATION') as Output<K>;
    const operation = createUsersApi(platform)[method] as (ctx: RequestContext, value: unknown) => Promise<Result<unknown>>;
    return await operation(context.value, parsed.data) as Output<K>;
  } catch { return failure('UNAVAILABLE') as Output<K>; }
}

export async function listUsers(input: Input<'listUsers'>) { return invoke('listUsers', input); }
export async function getUser(input: Input<'getUser'>) { return invoke('getUser', input); }
export async function listProjectMembers(input: Input<'listProjectMembers'>) { return invoke('listProjectMembers', input); }
export async function createUser(input: Input<'createUser'>) { return invoke('createUser', input); }
export async function updateUser(input: Input<'updateUser'>) { return invoke('updateUser', input); }
export async function setUserActive(input: Input<'setUserActive'>) { return invoke('setUserActive', input); }
export async function resetPassword(input: Input<'resetPassword'>) { return invoke('resetPassword', input); }
export async function setMembership(input: Input<'setMembership'>) { return invoke('setMembership', input); }
export async function removeMembership(input: Input<'removeMembership'>) { return invoke('removeMembership', input); }
export async function setFinanceAccess(input: Input<'setFinanceAccess'>) { return invoke('setFinanceAccess', input); }

/** Promote a person to admin or demote an admin. The server decides (any admin, never yourself, never the last one). */
export async function setOwnerLevel(input: SetOwnerLevelInput): Promise<Result<{ id: string; revision: number }>> {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return context;
    const parsed = SetOwnerLevelSchema.safeParse(input);
    if (!parsed.success) return failure('VALIDATION');
    return await createOwnerLevelCommand(platform).setOwnerLevel(context.value, parsed.data);
  } catch { return failure('UNAVAILABLE'); }
}

/** Add a person to every open project they are not in yet (owner only). Finance stays off; existing roles are untouched. */
export async function addToAllProjects(input: AddToAllProjectsInput): Promise<Result<AddToAllProjectsResult>> {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return context;
    const parsed = AddToAllProjectsSchema.safeParse(input);
    if (!parsed.success) return failure('VALIDATION');
    return await createBulkAccessCommand(platform).addToAllProjects(context.value, parsed.data);
  } catch { return failure('UNAVAILABLE'); }
}

/** Mark an admin as technical, so the person is not offered as a task assignee (owner only; the server checks). */
export async function setTechnicalAdmin(input: SetTechnicalAdminInput): Promise<Result<{ id: string; revision: number }>> {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return context;
    const parsed = SetTechnicalAdminSchema.safeParse(input);
    if (!parsed.success) return failure('VALIDATION');
    return await createTechnicalAdminCommand(platform).setTechnicalAdmin(context.value, parsed.data);
  } catch { return failure('UNAVAILABLE'); }
}
