import { randomUUID, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../../src/types/database';

export const projectRef = 'izjmvyguzbampoasvnru';
export const runId = randomUUID();
export type Client = SupabaseClient<Database>;
export type TestActor = { id: string; client: Client; sessionId: string };
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
export function environment() {
  const file = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {};
  const read = (name: string) => process.env[name] || file[name];
  const url = read('SUPABASE_URL');
  const publishable = read('SUPABASE_PUBLISHABLE_KEY');
  const secret = read('SUPABASE_SECRET_KEY');
  if (!url || !publishable || !secret) throw new Error('חסרים SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY או SUPABASE_SECRET_KEY');
  if (new URL(url).hostname !== `${projectRef}.supabase.co`) throw new Error('בדיקות מותרות רק בפרויקט הפיתוח המאושר');
  return { url, publishable, secret };
}
export function clients() {
  const env = environment();
  return { admin: createClient<Database>(env.url, env.secret, options),
    anonymous: createClient<Database>(env.url, env.publishable, options) };
}
export async function rpc(client: Client, name: keyof Database['public']['Functions'], input: Json = {}) {
  return client.rpc(name, { input });
}
export async function value<T>(client: Client, name: keyof Database['public']['Functions'], input: Json = {}): Promise<T> {
  const { data, error } = await rpc(client, name, input);
  if (error) throw new Error(`${name}: ${error.code}: ${error.message}`);
  return data as T;
}
export async function login(email: string, password: string): Promise<TestActor> {
  const env = environment();
  const client = createClient<Database>(env.url, env.publishable, options);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`כניסת בדיקה נכשלה: ${error?.code ?? 'missing_session'}`);
  const claims = JSON.parse(Buffer.from(data.session.access_token.split('.')[1], 'base64url').toString()) as { session_id: string };
  return { id: data.user.id, client, sessionId: claims.session_id };
}
const ownerFile = 'supabase/.temp/p12-owner.json';
export async function owner(admin: Client): Promise<TestActor> {
  // Credentials are generated, never logged, ignored by Git, and reused across test runs.
  if (existsSync(ownerFile)) {
    const saved = JSON.parse(readFileSync(ownerFile, 'utf8')) as { email: string; password: string };
    return login(saved.email, saved.password);
  }
  const email = `p12-owner-${runId}@example.invalid`;
  const password = randomBytes(32).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`יצירת בעלים בדוי נכשלה: ${error?.code ?? 'missing_user'}`);
  await value(admin, 'system_bootstrap_owner', { userId: data.user.id, fullName: 'בעלים בדוי לבדיקות' });
  mkdirSync('supabase/.temp', { recursive: true });
  writeFileSync(ownerFile, JSON.stringify({ email, password }), { mode: 0o600 });
  return login(email, password);
}
export async function actor(admin: Client, ownerClient: Client, label: string): Promise<TestActor> {
  const email = `p12-${label}-${randomUUID()}@example.invalid`;
  const password = randomBytes(32).toString('base64url');
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`יצירת משתמש בדוי נכשלה: ${error.code}`);
  await value(ownerClient, 'create_profile', { email, fullName: `בדיקה ${label}` });
  return login(email, password);
}
export async function project(client: Client, label: string) {
  return value<{ id: string; revision: number }>(client, 'create_project', {
    requestId: randomUUID(), fields: { name: `בדיקה ${label} ${runId}`, businessName: `עסק בדוי ${runId}`,
      siteAddress: 'רחוב הבדיקה 1', contact: { name: 'איש בדיקה', phone: '0000000000', email: null, roleTitle: null },
      startDate: null, endDate: null, accessNotes: null, businessNumber: 'TEST' },
  });
}
export async function membership(client: Client, userId: string, projectId: string, role: 'manager' | 'worker') {
  return value<{ revision: number; financeAccess: boolean }>(client, 'set_membership', { userId, projectId, role, expectedRevision: null });
}
export async function readyFile(admin: Client, uploader: TestActor, projectId: string, purpose: 'document' | 'diary' | 'cover') {
  const files = await value<{ fileId: string }[]>(uploader.client, 'begin_upload', {
    projectId, purpose, files: [{ clientId: randomUUID(), name: 'בדיקה.png', mime: 'image/png', sizeBytes: 8 }],
  });
  const fileId = files[0].fileId;
  await value(admin, 'system_finish_upload', { fileId, actorId: uploader.id, sessionId: uploader.sessionId,
    state: 'ready', mime: 'image/png', sizeBytes: 8, sha256: 'a'.repeat(64), displayState: 'none', displayPath: null });
  return fileId;
}
