import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (name: string) => readFileSync(new URL(`../../../src/features/reports/logic/${name}`, import.meta.url), 'utf8');
const useServer = /^\s*['"]use server['"]/m;

describe('Reports module boundaries', () => {
  it.each(['index.ts', 'service.ts', 'queries.ts', 'adapter.ts'])('%s is server-only and is not an action module', name => {
    expect(source(name)).toMatch(/import ['"]server-only['"]/);
    expect(source(name)).not.toMatch(useServer);
  });
  it('actions.ts is the action module', () => {
    expect(source('actions.ts').trimStart()).toMatch(/^['"]use server['"]/);
  });
});
