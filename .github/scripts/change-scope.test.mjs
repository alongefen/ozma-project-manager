import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { classifyChangeScope } from './change-scope.mjs';

function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'change-scope-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=Scope Test', '-c', 'user.email=scope@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
  const write = (path, text) => { mkdirSync(dirname(join(cwd, path)), { recursive: true }); writeFileSync(join(cwd, path), text); };
  const commit = () => { git('add', '--all'); git('commit', '--quiet', '-m', 'fixture'); return git('rev-parse', 'HEAD'); };
  git('init', '--quiet', '-b', 'main');
  write('src/app.ts', 'export const value = 1;\n');
  write('docs/guide.md', 'תיעוד\n');
  const base = commit();
  return { cwd, git, write, commit, base };
}

for (const path of ['AGENTS.md', 'README.md', 'docs/tasks/ONE.md', 'supabase/README.md', 'src/features/reports/assets/README.md']) {
  test(`known documentation: ${path}`, (t) => {
    const r = repository(t); r.write(path, 'תיעוד חדש\n');
    assert.equal(classifyChangeScope('push', { before: r.base, after: r.commit() }, r.cwd).docsOnly, true);
  });
}
for (const path of ['src/README.md', '.github/workflows/ci.yml', 'package.json', 'docs/example.ts']) {
  test(`code or unknown path: ${path}`, (t) => {
    const r = repository(t); r.write(path, 'fixture'); r.write('docs/guide.md', 'עוד תיעוד');
    assert.equal(classifyChangeScope('push', { before: r.base, after: r.commit() }, r.cwd).docsOnly, false);
  });
}
test('code renamed to documentation still requires full checks', (t) => {
  const r = repository(t); renameSync(join(r.cwd, 'src/app.ts'), join(r.cwd, 'docs/app.md'));
  assert.equal(classifyChangeScope('push', { before: r.base, after: r.commit() }, r.cwd).docsOnly, false);
});
test('deleted code still requires full checks', (t) => {
  const r = repository(t); rmSync(join(r.cwd, 'src/app.ts'));
  assert.equal(classifyChangeScope('push', { before: r.base, after: r.commit() }, r.cwd).docsOnly, false);
});
test('deleted documentation alone skips code checks', (t) => {
  const r = repository(t); rmSync(join(r.cwd, 'docs/guide.md'));
  assert.equal(classifyChangeScope('push', { before: r.base, after: r.commit() }, r.cwd).docsOnly, true);
});
test('PR uses merge-base, excluding independent base changes', (t) => {
  const r = repository(t); r.git('checkout', '--quiet', '-b', 'topic');
  r.write('docs/guide.md', 'ענף'); const head = r.commit();
  r.git('checkout', '--quiet', 'main'); r.write('src/app.ts', 'export const value = 2;'); const base = r.commit();
  assert.equal(classifyChangeScope('pull_request', { pull_request: { base: { sha: base }, head: { sha: head } } }, r.cwd).docsOnly, true);
});
test('push compares the complete before/after range, not just the last commit', (t) => {
  const r = repository(t); r.write('src/app.ts', 'export const value = 2;'); r.commit();
  r.write('docs/guide.md', 'תיעוד'); const head = r.commit();
  assert.equal(classifyChangeScope('push', { before: r.base, after: head }, r.cwd).docsOnly, false);
});
test('push ignores an intermediate code change reverted within the range', (t) => {
  const r = repository(t); r.write('src/app.ts', 'temporary'); r.commit();
  r.write('src/app.ts', 'export const value = 1;\n'); r.write('docs/guide.md', 'תיעוד');
  assert.equal(classifyChangeScope('push', { before: r.base, after: r.commit() }, r.cwd).docsOnly, true);
});
test('unusual code filename cannot be split into documentation paths', (t) => {
  const r = repository(t); r.write('src/odd\nREADME.md', 'fixture');
  assert.equal(classifyChangeScope('push', { before: r.base, after: r.commit() }, r.cwd).docsOnly, false);
});
test('missing, invalid, unavailable and empty ranges fall back to full checks', (t) => {
  const r = repository(t);
  for (const before of [undefined, '0'.repeat(40), 'bad', 'f'.repeat(40), r.base]) {
    assert.equal(classifyChangeScope('push', { before, after: r.base }, r.cwd).docsOnly, false);
  }
  assert.equal(classifyChangeScope('workflow_dispatch', {}, r.cwd).docsOnly, false);
  assert.equal(classifyChangeScope('pull_request', {}, r.cwd).docsOnly, false);
});

test('every code step runs when classification fails after writing docs_only=true', () => {
  const workflow = readFileSync(new URL('../workflows/ci.yml', import.meta.url), 'utf8');
  const steps = workflow.split(/\n      - /).slice(1);
  const codeSteps = steps.slice(2); // checkout and classification precede every code step.
  assert.equal(codeSteps.length, 8);
  for (const step of codeSteps) {
    const condition = step.match(/(?:^|\n        )if: (.+)/)?.[1];
    assert.ok(condition, 'every code step must have a scope condition');
    const shouldRun = new Function('steps', `return (${condition});`);
    for (const outcome of ['failure', 'cancelled', 'skipped']) {
      assert.equal(shouldRun({ scope: { outcome, outputs: { docs_only: 'true' } } }), true);
    }
    assert.equal(shouldRun({ scope: { outcome: 'success', outputs: { docs_only: 'true' } } }), false);
    assert.equal(shouldRun({ scope: { outcome: 'success', outputs: {} } }), true);
  }
});
