'use server';
import type { RequestContext, Result } from '@/types/contracts';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { createContactsApi } from './index';
import type { ContactsApi } from './api';

async function run<T>(op: (api: ContactsApi, ctx: RequestContext) => Promise<Result<T>>): Promise<Result<T>> {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return context;
    return await op(createContactsApi(platform), context.value);
  } catch { return failure('UNAVAILABLE'); }
}
export async function createContact(input: Parameters<ContactsApi['createContact']>[1]) { return run((a, c) => a.createContact(c, input)); }
export async function updateContact(input: Parameters<ContactsApi['updateContact']>[1]) { return run((a, c) => a.updateContact(c, input)); }
export async function removeContact(input: Parameters<ContactsApi['removeContact']>[1]) { return run((a, c) => a.removeContact(c, input)); }
