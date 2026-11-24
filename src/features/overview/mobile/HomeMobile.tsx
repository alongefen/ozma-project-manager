import type { HomeData } from '@/types/contracts';
import { Counters, Cube, ProjectsHead } from '../shared/Parts';
import { ProjectsBrowser } from '../shared/ProjectsBrowser';
import m from './Mobile.module.css';

/** Phone: counters, the finance card (owner only), then the searchable project cards. No sidebar, no tab bar. */
export function HomeMobile({ data, isOwner }: { data: HomeData; isOwner: boolean }) {
  return (
    <div className={`${m.page} m-only`}>
      <Counters counters={data.counters} />
      {data.financeCube && <Cube cube={data.financeCube} />}
      <ProjectsHead isOwner={isOwner} />
      <ProjectsBrowser projects={data.projects} />
    </div>
  );
}
