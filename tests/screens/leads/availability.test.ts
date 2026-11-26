import { afterEach, describe, expect, it, vi } from 'vitest';

// The wrapper is server-only in Next; execute its policy locally without a server runtime.
vi.mock('server-only', () => ({}));
import { leadsAvailability } from '@/features/leads/logic/availability-policy';
import { isLeadsAvailable } from '@/features/leads/logic/availability';

afterEach(() => vi.unstubAllEnvs());

describe('leads availability policy', () => {
  it.each([
    ['preview', 'true', true, true],
    ['preview', 'true', false, false],
    ['production', 'true', true, false],
    ['production', 'true', false, false],
    ['development', 'true', true, false],
    [undefined, 'true', true, false],
    ['', 'true', true, false],
    ['staging', 'true', true, false],
    ['Preview', 'true', true, false],
    ['preview', undefined, true, false],
    ['preview', '', true, false],
    ['preview', 'false', true, false],
    ['preview', 'TRUE', true, false],
    ['preview', '1', true, false],
    ['preview', ' true ', true, false],
  ] as const)('environment=%s flag=%s admin=%s => %s', (environment, enabled, isAdmin, expected) => {
    expect(leadsAvailability({ environment, enabled, isAdmin })).toBe(expected);
  });
});

describe('server availability boundary', () => {
  it('reads server settings on each call and does not retain another actor or environment', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('LEADS_PREVIEW_ENABLED', 'true');
    expect(isLeadsAvailable(true)).toBe(true);
    expect(isLeadsAvailable(false)).toBe(false);
    expect(isLeadsAvailable(true)).toBe(true);
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(isLeadsAvailable(true)).toBe(false);
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('LEADS_PREVIEW_ENABLED', undefined);
    expect(isLeadsAvailable(true)).toBe(false);
  });

  it('does not accept NODE_ENV or public flags as a substitute for server settings', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_LEADS_PREVIEW_ENABLED', 'true');
    vi.stubEnv('VERCEL_ENV', undefined);
    vi.stubEnv('LEADS_PREVIEW_ENABLED', undefined);
    expect(isLeadsAvailable(true)).toBe(false);
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(isLeadsAvailable(true)).toBe(false);
    vi.stubEnv('LEADS_PREVIEW_ENABLED', 'true');
    expect(isLeadsAvailable(true)).toBe(true);
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(isLeadsAvailable(true)).toBe(false);
  });
});
