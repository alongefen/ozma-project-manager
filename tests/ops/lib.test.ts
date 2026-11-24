import {describe, expect, it} from 'vitest';
import {generatePassword, maskEmail, parseArgs, PROJECT_REF, requireEnv, resolveMode, stableUuid} from '../../scripts/ops/lib.mjs';

const env = {SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`};

describe('go-live lib', () => {
  it('parses flags in all three shapes', () => {
    expect(parseArgs(['--confirm', '--project-ref=abc', '--input', 'f.json'])).toEqual({confirm: true, 'project-ref': 'abc', input: 'f.json'});
  });
  it('is a dry run unless --confirm is given', () => {
    expect(resolveMode({}, env)).toEqual({write: false});
  });
  it('refuses a real run without the project ref typed, or with a wrong one', () => {
    expect(() => resolveMode({confirm: true}, env)).toThrow(/project-ref/);
    expect(() => resolveMode({confirm: true, 'project-ref': 'other'}, env)).toThrow(/project-ref/);
    expect(resolveMode({confirm: true, 'project-ref': PROJECT_REF}, env)).toEqual({write: true});
  });
  it('refuses any other Supabase project, even for a dry run', () => {
    expect(() => resolveMode({}, {SUPABASE_URL: 'https://zzz.supabase.co'})).toThrow(/does not point/);
    expect(() => resolveMode({}, {})).toThrow();
  });
  it('reports missing env by name only', () => {
    expect(() => requireEnv({A: 'secret-value'}, ['A', 'B'])).toThrow('B');
    try { requireEnv({A: 'secret-value'}, ['A', 'B']); } catch (e) { expect(String(e)).not.toContain('secret-value'); }
  });
  it('generates strong distinct passwords and stable uuids', () => {
    expect(generatePassword()).toHaveLength(24);
    expect(generatePassword()).not.toBe(generatePassword());
    expect(stableUuid('x')).toBe(stableUuid('x'));
    expect(stableUuid('x')).not.toBe(stableUuid('y'));
    expect(stableUuid('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('masks emails', () => { expect(maskEmail('alon@gmail.com')).toBe('a***@gmail.com'); });
});
