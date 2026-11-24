import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// P3.1 static checks: no cloud, no secrets read. Server/client boundaries, secret patterns in the tree,
// in every commit of the repo, and in the built client bundle (when .next exists).
const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};
const src = walk('src').filter(f => /\.(ts|tsx)$/.test(f));
const read = (f: string) => readFileSync(f, 'utf8');
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
// Shapes only (never real values): Supabase secret keys, legacy JWT service-role keys, private keys, PATs.
const secretShapes: [string, RegExp][] = [
  ['supabase secret key', /sb_secret_[A-Za-z0-9_-]{16,}/],
  ['supabase db password url', /postgres(ql)?:\/\/[^\s:@]+:[^\s:@]{6,}@/],
  ['jwt (anon/service role)', /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['github token', /gh[pousr]_[A-Za-z0-9]{30,}/],
  ['vercel token', /\bvercel_[A-Za-z0-9]{20,}/],
];

describe('server and client boundaries', () => {
  it("'use server' appears only in actions.ts files", () => {
    const marked = src.filter(f => /^\s*['"]use server['"]/m.test(read(f)));
    expect(marked.length).toBeGreaterThan(5);
    expect(marked.filter(f => !/(^|\/)actions\.ts$/.test(f))).toEqual([]);
  });
  it('queries.ts and commands.ts are server-only', () => {
    const files = src.filter(f => /(^|\/)(queries|commands)\.ts$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter(f => !/import ['"]server-only['"]/.test(read(f)))).toEqual([]);
  });
  it('every module that touches the secret key or the privileged client is server-only', () => {
    const touching = src.filter(f => f !== 'src/proxy.ts' /* runs on the server only, never bundled for the browser */ && /SUPABASE_SECRET_KEY|createPrivilegedClient|createAuthClient|secretKey/.test(read(f)));
    expect(touching.length).toBeGreaterThan(0);
    expect(touching.filter(f => !/import ['"]server-only['"]/.test(read(f)))).toEqual([]);
  });
  it("no 'use client' file imports a server-only module or reads process.env secrets", () => {
    const clients = src.filter(f => /^\s*['"]use client['"]/m.test(read(f)));
    expect(clients.length).toBeGreaterThan(10);
    const bad = clients.filter(f => /server-only|lib\/db\/clients|lib\/auth\/platform|\/queries['"]|\/commands['"]|process\.env\.SUPABASE|SECRET/.test(read(f)));
    expect(bad).toEqual([]);
  });
  it('no NEXT_PUBLIC variable carries a key or secret', () => {
    const hits = src.filter(f => /NEXT_PUBLIC_[A-Z_]*(KEY|SECRET|TOKEN|SERVICE)/.test(read(f)));
    expect(hits).toEqual([]);
  });
  it('Server Actions never take identity or role from the client input', () => {
    // Identity and context come from the server (AGENTS technical). Actions must not read userId/actor/role from their argument.
    const actions = src.filter(f => /(^|\/)actions\.ts$/.test(f));
    const bad = actions.filter(f => /(input|data|payload)\.(actorId|actor|role|isOwner|ownerId)\b/.test(read(f)));
    expect(bad).toEqual([]);
  });
  it('API routes resolve the caller before doing any work', () => {
    const routes = src.filter(f => /app\/api\/.*route\.ts$/.test(f));
    expect(routes).toHaveLength(5);
    for (const f of routes) {
      const text = read(f);
      expect(text, f).toMatch(/auth\.getContext\(\)/);
      expect(text.indexOf('getContext'), f).toBeLessThan(text.search(/request\.json\(|\.renderReportPart\(|\.renderWorkbook\(|\.getSignedUrl\(|\.beginUpload\(|\.finishUpload\(/));
    }
  });
  it('state-changing API routes (POST) check same-origin', () => {
    for (const f of src.filter(f => /app\/api\/.*route\.ts$/.test(f) && /export async function POST/.test(read(f)))) expect(read(f), f).toMatch(/sameOrigin\(request\)/);
  });
});

describe('secrets in the tree, in git and in env handling', () => {
  it('env files with values are ignored by git and untracked', () => {
    const tracked = git('ls-files').split('\n');
    expect(tracked.filter(f => /(^|\/)\.env/.test(f) && !f.endsWith('.env.example'))).toEqual([]);
    expect(tracked.filter(f => /(^|\/)supabase\/\.temp\//.test(f) || /\.(pem|key)$/.test(f))).toEqual([]);
    expect(() => git('check-ignore', '-q', '.env.local')).not.toThrow();
    expect(() => git('check-ignore', '-q', 'supabase/.temp/p12-owner.json')).not.toThrow();
    expect(read('.env.example')).not.toMatch(/sb_secret_|eyJ/);
  });
  it('no secret-shaped string in any tracked file', () => {
    const hits: string[] = [];
    for (const f of git('ls-files').split('\n').filter(Boolean)) {
      if (!existsSync(f) || /\.(png|jpg|jpeg|ico|woff2?|ttf|otf|pdf|xlsx|lock)$|package-lock/.test(f)) continue;
      const text = read(f);
      for (const [name, re] of secretShapes) if (re.test(text)) hits.push(`${f}: ${name}`);
    }
    expect(hits).toEqual([]);
  });
  it('no secret-shaped string in the content or name of any commit on any branch', { timeout: 120_000 }, () => {
    const hits: string[] = [];
    // git grep over every distinct tree is too slow; pickaxe regex over all history instead (added/removed lines only).
    // `git log -G` uses POSIX ERE (no \b, \s, \d), so these are the same shapes written for ERE.
    const ere: [string, string][] = [
      ['supabase secret key', 'sb_secret_[A-Za-z0-9_-]{16,}'],
      ['db password url', 'postgres(ql)?://[^[:space:]:@]+:[^[:space:]:@]{6,}@'],
      ['jwt', 'eyJ[A-Za-z0-9_-]{15,}[.]eyJ[A-Za-z0-9_-]{15,}[.][A-Za-z0-9_-]{10,}'],
      ['private key block', '-----BEGIN [A-Z ]*PRIVATE KEY-----'],
      ['github token', 'gh[pousr]_[A-Za-z0-9]{30,}'],
      ['vercel token', 'vercel_[A-Za-z0-9]{20,}'],
    ];
    // positive control: a pattern that is known to exist in history must be found, or the scan proves nothing
    expect(git('log', '--all', '--format=%h', '-G', 'izjmvyguzbampoasvnru[.]supabase|[A-Za-z]{5}_[A-Za-z]{5,}', '--', 'src').trim().length).toBeGreaterThan(0);
    expect(git('log', '--all', '--format=%h', '-G', 'import[[:space:]]+[{]', '--', 'src').trim().length).toBeGreaterThan(0);
    for (const [name, pattern] of ere) {
      const out = git('log', '--all', '--format=%h', '-G', pattern, '--', '.', ':(exclude)package-lock.json').trim();
      if (out) hits.push(`${name}: commits ${out.split('\n').slice(0, 5).join(',')}`);
    }
    expect(hits).toEqual([]);
  });
  it('no env file or credentials file was ever committed', () => {
    const names = git('log', '--all', '--name-only', '--format=').split('\n');
    const bad = [...new Set(names)].filter(f => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith('.env.example') || /p12-owner|credentials|\.pem$|service[-_]role/i.test(f));
    expect(bad).toEqual([]);
  });
  it('source never logs request bodies, tokens or keys', () => {
    const logging = src.filter(f => /console\.(log|info|warn|error|debug)\(/.test(read(f)));
    for (const f of logging) {
      const calls = read(f).match(/console\.(log|info|warn|error|debug)\([^;]*\)/g) ?? [];
      for (const c of calls) expect(c, f).not.toMatch(/token|secret|password|authorization|cookie|signedUrl|\.url\b|body|headers/i);
    }
  });
});

const hasBuild = existsSync('.next/static');
describe.skipIf(!hasBuild)('built client bundle and server output', () => {
  const files = hasBuild ? walk('.next/static').filter(f => /\.(js|css|html|json|map)$/.test(f)) : [];
  it('client chunks contain no secret-shaped string, no service-role names and no Supabase secret env name', () => {
    expect(files.length).toBeGreaterThan(5);
    const hits: string[] = [];
    for (const f of files) {
      const text = read(f);
      for (const [name, re] of secretShapes) if (re.test(text)) hits.push(`${f}: ${name}`);
      if (/SUPABASE_SECRET_KEY|service_role|serviceRole|SUPABASE_PUBLISHABLE_KEY/.test(text)) hits.push(`${f}: env or role name`);
    }
    expect(hits).toEqual([]);
  });
  it('client chunks contain no project URL or key at all (server-only configuration)', () => {
    const hits = files.filter(f => /izjmvyguzbampoasvnru|sb_publishable_/.test(read(f)));
    expect(hits).toEqual([]);
  });
  it('no source maps are published for the client', () => {
    expect(files.filter(f => f.endsWith('.map'))).toEqual([]);
  });
  it('server chunks reference the secret key only through the environment, never as a literal', () => {
    const hits: string[] = [];
    for (const f of walk('.next/server').filter(f => /\.(js|json)$/.test(f))) {
      const text = read(f);
      for (const [name, re] of secretShapes) if (re.test(text)) hits.push(`${f}: ${name}`);
    }
    expect(hits).toEqual([]);
  });
});
