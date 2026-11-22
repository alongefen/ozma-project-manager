import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const full = (reason) => ({ docsOnly: false, reason });
const validSha = (sha) => typeof sha === 'string' && /^[a-f0-9]{40}$/i.test(sha) && !/^0+$/.test(sha);
const documentationFiles = new Set(['AGENTS.md', 'README.md', 'supabase/README.md', 'src/features/reports/assets/README.md']);
const isDocumentation = (path) => documentationFiles.has(path) || /^docs\/.+\.md$/.test(path);

export function classifyChangeScope(eventName, event, cwd = process.cwd()) {
  const git = (...args) => execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    let base;
    let head;
    if (eventName === 'pull_request') {
      base = event.pull_request?.base?.sha;
      head = event.pull_request?.head?.sha;
      if (!validSha(base) || !validSha(head)) return full('missing-pr-range');
      const mergeBases = git('merge-base', '--all', base, head).trim().split('\n');
      if (mergeBases.length !== 1 || !validSha(mergeBases[0])) return full('ambiguous-merge-base');
      base = mergeBases[0];
    } else if (eventName === 'push') {
      base = event.before;
      head = event.after;
      if (!validSha(base) || !validSha(head)) return full('missing-push-range');
    } else {
      return full('unsupported-event');
    }
    // Disable rename detection: both the deleted path and added path must qualify.
    const paths = git('diff', '--name-only', '--no-renames', '-z', base, head, '--').split('\0').filter(Boolean);
    if (!paths.length) return full('empty-diff');
    return paths.every(isDocumentation)
      ? { docsOnly: true, reason: 'documentation-only' }
      : full('code-or-unknown-path');
  } catch {
    return full('unavailable-git-range');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let result;
  try {
    result = classifyChangeScope(process.env.GITHUB_EVENT_NAME, JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')));
  } catch {
    result = full('unavailable-event');
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `docs_only=${result.docsOnly}\n`);
  const message = result.docsOnly
    ? 'תיעוד בלבד: התקנת תלויות ובדיקות קוד אינן נדרשות.'
    : 'שינוי קוד, הגדרות או טווח לא ודאי: הבדיקות המלאות נדרשות.';
  console.log(`${message} (${result.reason})`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
}
