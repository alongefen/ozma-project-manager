import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname, isAbsolute, join, resolve} from 'node:path';

// Locates the gitignored cloud-test files. Paths only; never reads contents.
export function mainCheckout(cwd=process.cwd()):string {
  try {
    const common=execFileSync('git',['rev-parse','--git-common-dir'],{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
    const abs=isAbsolute(common) ? common : resolve(cwd,common);
    return dirname(abs);
  } catch { return cwd; }
}
function pick(override:string|undefined,relative:string,cwd:string):string {
  if(override) return override;
  const main=join(mainCheckout(cwd),relative);
  if(existsSync(main)) return main;
  return join(cwd,relative);
}
export function cloudEnvPath(env:NodeJS.ProcessEnv=process.env,cwd=process.cwd()) { return pick(env.P13_ENV_FILE,'.env.local',cwd); }
export function cloudOwnerPath(env:NodeJS.ProcessEnv=process.env,cwd=process.cwd()) { return pick(env.P13_OWNER_FIXTURE,'supabase/.temp/p12-owner.json',cwd); }
