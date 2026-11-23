import type { HomeData } from '@/types/contracts';
import { Counters, Cube, ProjectList } from '../shared/Parts';
import css from '../shared/Overview.module.css';
import d from './Desktop.module.css';

/** Desktop home: counters across the top, the project list as the main column, the summary column beside it. */
export function HomeDesktop({ data }: { data: HomeData }) {
  return (
    <div className={`${d.page} d-only`}>
      <div className={d.counters}><Counters counters={data.counters} /></div>
      <div className={d.cols}>
        <section className={d.main}>
          <h2 className={css.sectionTitle}>פרויקטים</h2>
          <div className={d.projects}><ProjectList projects={data.projects} /></div>
        </section>
        {data.financeCube && <aside className={d.side}><Cube cube={data.financeCube} panel /></aside>}
      </div>
    </div>
  );
}
