'use server';
import { createPlatform } from './platform';
import { failure } from '@/lib/db/rpc';
import type { Actor, Result } from '@/types/contracts';
export async function signIn(input: { email: string; password: string }): Promise<Result<Actor>> {
  try { return (await createPlatform()).auth.signIn(input); } catch { return failure('UNAVAILABLE'); }
}
export async function signOut(): Promise<Result<null>> {
  try { return (await createPlatform()).auth.signOut(); } catch { return failure('UNAVAILABLE'); }
}
