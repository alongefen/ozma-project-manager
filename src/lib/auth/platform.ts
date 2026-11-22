import 'server-only';
import { cookies, headers } from 'next/headers';
import type { Platform } from '@/types/contracts';
import { configuration, createAuthClient, createPrivilegedClient, createRequestDb, trustedClientIp } from '@/lib/db/clients';
import { rpc, fetchAll } from '@/lib/db/rpc';
import { format } from '@/lib/format';
import { permissions } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { createStorageService } from '@/lib/storage/service';
import { createAuthAdmin } from './admin';
import { createAuthService } from './service';

export async function createPlatform(): Promise<Platform> {
  const store = await cookies();
  const ip = trustedClientIp(await headers());
  const db = createRequestDb({ getAll: () => store.getAll(), setAll: values => { for (const { name, value, options } of values) store.set(name, value, options); } }, ip);
  const config = configuration();
  return {
    auth: createAuthService({ db, authClient: createAuthClient(ip) }),
    authAdmin: createAuthAdmin({ admin: createPrivilegedClient }),
    storage: createStorageService({ privileged: createPrivilegedClient, url: config.url, publishableKey: config.publishableKey }),
    permissions, audit, format, rpc, fetchAll,
  };
}
