// Shared helpers for the go-live scripts. Secrets come only from process.env
// (start node with --env-file=<path> if they live in a file). Nothing here prints them.
import {createHash, randomBytes} from 'node:crypto';

export const PROJECT_REF = 'izjmvyguzbampoasvnru';

// Parses `--flag`, `--key=value` and `--key value` style arguments.
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}

// Names only: a missing variable is reported by name, a value is never echoed.
export function requireEnv(env, names) {
  const missing = names.filter(n => !env[n]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  return Object.fromEntries(names.map(n => [n, env[n]]));
}

// A write needs --confirm AND the project ref typed by hand, AND SUPABASE_URL pointing at that ref.
// Without both flags the script stays a dry run.
export function resolveMode(args, env, ref = PROJECT_REF) {
  const url = env.SUPABASE_URL ? new URL(env.SUPABASE_URL) : null;
  if (!url || url.hostname !== `${ref}.supabase.co`) throw new Error(`SUPABASE_URL does not point at project ${ref}`);
  const wantsWrite = args.confirm === true || args.confirm === 'true';
  if (!wantsWrite) return {write: false};
  if (args['project-ref'] !== ref) throw new Error('A real run needs --project-ref=<the project ref, typed by hand> next to --confirm');
  return {write: true};
}

// Runs SQL through the Supabase Management API (same project, postgres role, no new service).
export function createSqlRunner({ref = PROJECT_REF, token, fetchImpl = fetch}) {
  return async function sql(query) {
    const res = await fetchImpl(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: {'content-type': 'application/json', authorization: `Bearer ${token}`},
      body: JSON.stringify({query}),
    });
    if (!res.ok) throw new Error(`SQL request failed with HTTP ${res.status}`);
    return res.json();
  };
}

// 24 random bytes, base64url: strong, no ambiguous symbols. Printed once by the caller, never stored.
export function generatePassword(bytes = 18) {
  return randomBytes(bytes).toString('base64url');
}

// Deterministic request id per logical row, so a retry never duplicates (stable uuid shape, version 5-like).
export function stableUuid(key) {
  const h = createHash('sha1').update(`ozma-go-live:${key}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

export function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  return `${local.slice(0, 1)}***@${domain ?? '?'}`;
}
