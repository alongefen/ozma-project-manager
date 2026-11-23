import type { HomeData } from '@/types/contracts';
import { Counters, Cube, ProjectList } from '../shared/Parts';
import css from '../shared/Overview.module.css';
import m from './Mobile.module.css';

/** Phone home: counters, the cube (owner only), then the project cards. No sidebar, no tab bar. */
export function HomeMobile({ data }: { data: HomeData }) {
  return (
    <div className={`${m.page} m-only`}>
      <Counters counters={data.counters} />
      {data.financeCube && <Cube cube={data.financeCube} />}
      <h2 className={css.sectionTitle}>פרויקטים</h2>
      <ProjectList projects={data.projects} />
    </div>
  );
}
