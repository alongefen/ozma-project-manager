import { expect,it,vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { desktopNav,moreLinks,phoneNav,screenTitle } from '@/lib/navigation';
vi.mock('server-only',()=>({}));
it('default-off and non-owner navigation never links leads',()=>{for(const owner of [true,false]){expect(desktopNav(owner).some(i=>i.key==='leads')).toBe(false);expect(moreLinks(owner).some(i=>i.key==='leads')).toBe(false);}expect(desktopNav(false,true).some(i=>i.key==='leads')).toBe(false);expect(moreLinks(false,true)).toEqual([]);});
it('only guarded sidebar and More add the implemented route',()=>{expect(desktopNav(true,true).some(i=>i.href==='/leads')).toBe(true);expect(moreLinks(true,true).some(i=>i.href==='/leads')).toBe(true);expect(existsSync('src/app/(app)/leads/page.tsx')).toBe(true);expect(screenTitle('/leads')).toBe('לידים');expect(phoneNav(true)[2]).toMatchObject({key:'report',prominent:true});expect(phoneNav(true).some(i=>i.key==='leads')).toBe(false);});
it('loading and error have no functional lead entry point',()=>{for(const name of ['loading','error']){const source=readFileSync(`src/app/(app)/leads/${name}.tsx`,'utf8');expect(source).not.toMatch(/LeadsProvider|LeadForm|createLead|listLeads|ליד חדש/);}});
