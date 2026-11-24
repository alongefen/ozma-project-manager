import type { HomeData } from '@/types/contracts';
import { Counters, Cube, ProjectsHead } from '../shared/Parts';
import { ProjectsBrowser } from '../shared/ProjectsBrowser';
import d from './Desktop.module.css';

/** Desktop: counters row, the wide finance card (owner only) on top with the rest of the cards, then the searchable project grid. */
export function HomeDesktop({ data, isOwner }: { data: HomeData; isOwner: boolean }) {
  return (
    <div className={`${d.page} d-only`}>
      <div className={d.counters}><Counters counters={data.counters} /></div>
      {data.financeCube && <Cube cube={data.financeCube} />}
      <ProjectsHead isOwner={isOwner} />
      <div className={d.projects}><ProjectsBrowser projects={data.projects} /></div>
    </div>
  );
}
