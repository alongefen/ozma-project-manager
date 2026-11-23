import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {realpathSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {cloudEnvPath,cloudOwnerPath,mainCheckout} from './cloud-paths';

const git=(cwd:string,...a:string[])=>execFileSync('git',a,{cwd,stdio:'ignore'});
function setup() {
  const root=realpathSync(mkdtempSync(join(tmpdir(),'cloudpaths-')));
  const main=join(root,'main'); mkdirSync(main);
  git(main,'init','-q'); git(main,'-c','user.name=t','-c','user.email=t@example.invalid','commit','-q','--allow-empty','-m','x');
  const wt=join(root,'wt'); git(main,'worktree','add','-q','-b','b',wt);
  return {main,wt};
}
describe('cloud paths',()=>{
  it('defaults to the main checkout files from a worktree',()=>{
    const {main,wt}=setup();
    mkdirSync(join(main,'supabase/.temp'),{recursive:true});
    writeFileSync(join(main,'.env.local'),'');writeFileSync(join(main,'supabase/.temp/p12-owner.json'),'');
    expect(mainCheckout(wt)).toBe(main);
    expect(cloudEnvPath({},wt)).toBe(join(main,'.env.local'));
    expect(cloudOwnerPath({},wt)).toBe(join(main,'supabase/.temp/p12-owner.json'));
  });
  it('falls back to the current checkout when main has no file',()=>{
    const {wt}=setup();
    expect(cloudEnvPath({},wt)).toBe(join(wt,'.env.local'));
  });
  it('env overrides win',()=>{
    expect(cloudEnvPath({P13_ENV_FILE:'/x/e'})).toBe('/x/e');
    expect(cloudOwnerPath({P13_OWNER_FIXTURE:'/x/o'})).toBe('/x/o');
  });
});
