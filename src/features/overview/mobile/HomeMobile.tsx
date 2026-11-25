import type { HomeData } from '@/types/contracts';
import { Counters } from '../shared/Parts';
import { ProjectsBrowser } from '../shared/ProjectsBrowser';
import m from './Mobile.module.css';

/** Phone: counters, then the searchable project cards. No sidebar, no tab bar. */
export function HomeMobile({ data, isOwner }: { data: HomeData; isOwner: boolean }) {
  return (
    <div className={`${m.page} m-only`}>
      <Counters counters={data.counters} />
      <ProjectsBrowser projects={data.projects} isOwner={isOwner} />
    </div>
  );
}
