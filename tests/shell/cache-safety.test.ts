import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('no cross-user caching of reads (identity and finance never shared)', () => {
  const sources = files(join(root, 'src')).map(path => ({ path, text: readFileSync(path, 'utf8') }));

  it('uses no server-side cross-request cache anywhere in src', () => {
    const banned = /unstable_cache|['"]use cache['"]|cacheComponents|force-cache|export const revalidate|next:\s*\{\s*revalidate/;
    expect(sources.filter(s => banned.test(s.text)).map(s => s.path)).toEqual([]);
  });

  it('keeps identity lookup in a per-request memo with no module state', () => {
    const request = readFileSync(join(root, 'src/components/shell/request.ts'), 'utf8');
    expect(request).toMatch(/from 'react'/);
    expect(request).toMatch(/cache\(/);
    expect(request).not.toMatch(/^(let|var)\s|new Map|new WeakMap|new Set/m);
  });

  it('routes every layout/page identity read through the per-request memo, not a second platform', () => {
    const offenders = sources.filter(s => /src\/app\/\(app\)\/.*(layout|page)\.tsx$/.test(s.path) && /createPlatform\(/.test(s.text));
    expect(offenders.map(s => s.path)).toEqual([]);
  });

  it('bounds the client router cache so a permission change is never stale for long', () => {
    const config = readFileSync(join(root, 'next.config.ts'), 'utf8');
    const dynamic = Number(/dynamic:\s*(\d+)/.exec(config)?.[1]);
    expect(dynamic).toBeGreaterThan(0);
    expect(dynamic).toBeLessThanOrEqual(60);
  });
});
