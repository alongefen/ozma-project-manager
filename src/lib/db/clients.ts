import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { isIP } from 'node:net';

export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'lax' as const, path: '/', maxAge: 400 * 24 * 60 * 60 };
export function configuration() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) throw new Error('חסרות הגדרות חיבור לשרת');
  return { url, publishableKey, secretKey };
}
// Only use the deployment-owned header. User-supplied x-forwarded-for is never trusted.
export function trustedClientIp(headers: Headers): string | undefined {
  if (process.env.VERCEL !== '1') return undefined;
  const ip = headers.get('x-vercel-forwarded-for')?.split(',')[0].trim();
  return ip && isIP(ip) ? ip : undefined;
}
export function createPrivilegedClient() {
  const config = configuration();
  return createClient<Database>(config.url, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
export function createAuthClient(ip?: string) {
  const config = configuration();
  return createClient<Database>(config.url, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: ip ? { 'Sb-Forwarded-For': ip } : {} } });
}
export function createRequestDb(cookies: CookieMethodsServer, ip?: string) {
  const config = configuration();
  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies, cookieOptions,
    global: { fetch: async (input, init) => {
      const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      const headers = new Headers(init?.headers);
      // Secret key is confined to the Auth token endpoint for rate-limit IP forwarding.
      if (target.origin === new URL(config.url).origin && target.pathname === '/auth/v1/token') {
        headers.set('apikey', config.secretKey);
        if (ip) headers.set('Sb-Forwarded-For', ip);
      }
      return fetch(input, { ...init, headers, cache: 'no-store' });
    } },
  });
}
