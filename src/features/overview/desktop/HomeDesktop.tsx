import type { HomeData } from '@/types/contracts';
import { DesktopTitle } from '@/components/ui';
import { Counters, Cube } from '../shared/Parts';
import { ProjectsBrowser } from '../shared/ProjectsBrowser';
import d from './Desktop.module.css';

/** Desktop: counters row, the wide finance card (owner only) on top with the rest of the cards, then the searchable project grid. */
export function HomeDesktop({ data, isOwner }: { data: HomeData; isOwner: boolean }) {
  return (
    <div className={`${d.page} d-only`}>
      <DesktopTitle title="פרויקטים" />
      <div className={d.counters}><Counters counters={data.counters} /></div>
      {data.financeCube && <Cube cube={data.financeCube} />}
      <div className={d.projects}><ProjectsBrowser projects={data.projects} isOwner={isOwner} /></div>
    </div>
  );
}
