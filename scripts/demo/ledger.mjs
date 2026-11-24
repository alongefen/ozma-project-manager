// The local, git-ignored record of EVERYTHING the demo seed created. The remove script deletes only what is listed here.
import {existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';

export const LEDGER_PATH = 'scripts/demo/out/ledger.local.json';
const LISTS = ['authUsers', 'profiles', 'projects', 'memberships', 'storedFiles', 'storage', 'documents', 'diaryEntries', 'tasks', 'transactions'];

/** @returns {any} */
export function emptyLedger(ref) {
  return {version: 1, projectRef: ref, createdAt: new Date().toISOString(), steps: {}, ...Object.fromEntries(LISTS.map(l => [l, []]))};
}

/** @returns {any} */
export function loadLedger(path = LEDGER_PATH, ref, fs = {exists: existsSync, read: p => readFileSync(p, 'utf8')}) {
  if (!fs.exists(path)) return emptyLedger(ref);
  const data = JSON.parse(fs.read(path));
  if (data.version !== 1) throw new Error('Unknown ledger version');
  if (ref && data.projectRef !== ref) throw new Error(`The ledger belongs to project ${data.projectRef}, not ${ref}`);
  for (const l of LISTS) data[l] ??= [];
  data.steps ??= {};
  return data;
}

// Atomic: write a temp file, then rename, so a crash never leaves a half-written ledger.
export function saveLedger(ledger, path = LEDGER_PATH, fs = {mkdir: p => mkdirSync(p, {recursive: true}), write: writeFileSync, rename: renameSync}) {
  fs.mkdir(dirname(path));
  fs.write(`${path}.tmp`, JSON.stringify(ledger, null, 2));
  fs.rename(`${path}.tmp`, path);
}

const keyOf = (list, item) => (list === 'memberships' ? `${item.projectId}:${item.userId}` : list === 'storage' ? `${item.bucket}:${item.path}` : item.id);

// Idempotent add: re-adding the same item never duplicates.
export function record(ledger, list, item) {
  if (!LISTS.includes(list)) throw new Error(`Unknown ledger list: ${list}`);
  if (!ledger[list].some(x => keyOf(list, x) === keyOf(list, item))) ledger[list].push(item);
  return item;
}

export const ledgerCounts = ledger => Object.fromEntries(LISTS.map(l => [l, ledger[l].length]));
export const ids = (ledger, list) => ledger[list].map(x => x.id);

// After a verified removal: keep a copy as <path>.removed.json and delete the live ledger.
export function archiveLedger(ledger, path = LEDGER_PATH, fs = {mkdir: p => mkdirSync(p, {recursive: true}), write: writeFileSync, rename: renameSync, unlink: unlinkSync}) {
  saveLedger(ledger, `${path}.removed.json`, fs);
  fs.unlink(path);
}
