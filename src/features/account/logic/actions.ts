'use server';
import type { Result } from '@/types/contracts';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { changeOwnName, changeOwnPasswordForRequest, type ChangeNameInput, type ChangePasswordInput } from './commands';

/** Identity always comes from the server session; the input carries no user id. */
export async function changePassword(input: ChangePasswordInput): Promise<Result<{ othersSignedOut: boolean }>> {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return context;
    return await changeOwnPasswordForRequest(context.value, input);
  } catch { return failure('UNAVAILABLE'); }
}

export async function changeName(input: ChangeNameInput): Promise<Result<{ id: string; revision: number }>> {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return context;
    return await changeOwnName(platform, context.value, input);
  } catch { return failure('UNAVAILABLE'); }
}
