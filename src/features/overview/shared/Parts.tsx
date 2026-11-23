import Link from 'next/link';
import type { HomeData, ProjectCard } from '@/types/contracts';
import { Badge, Card } from '@/components/ui';
import { coverSrc } from '@/features/projects/shared/view-model';
import { cubeRows, cubeTitle, counterItems, projectBadges, NO_PROJECTS } from './view-model';
import css from './Overview.module.css';

export function Counters({ counters }: { counters: HomeData['counters'] }) {
  return (
    <div className={css.counters}>
      {counterItems(counters).map(item => (
        <Card key={item.key} className={css.counter}>
          <span className={css.counterValue}>{item.value}</span>
          <span className={css.counterLabel}>{item.label}</span>
        </Card>
      ))}
    </div>
  );
}

/** The finance cube. Rendered only when the server sent one (the owner); never an empty frame for anyone else. */
export function Cube({ cube, panel }: { cube: NonNullable<HomeData['financeCube']>; panel?: boolean }) {
  return (
    <Card panel={panel} className={css.cube}>
      <h2 className={css.cubeTitle}>{cubeTitle(cube)}</h2>
      <dl className={css.cubeRows}>
        {cubeRows(cube).map(row => (
          <div key={row.key}><dt>{row.label}</dt><dd className={css.num}>{row.value}</dd></div>
        ))}
      </dl>
      <Link href="/finance" className={css.link}>סכום העברה ופירוט לפי חודשים</Link>
    </Card>
  );
}

export function ProjectList({ projects }: { projects: ProjectCard[] }) {
  if (projects.length === 0) return <Card><p className={css.empty}>{NO_PROJECTS}</p></Card>;
  return (
    <ul className={css.list}>
      {projects.map(card => {
        const cover = coverSrc(card.coverFileId);
        return (
          <li key={card.id}>
            <Link href={`/projects/${card.id}`} className={`ui-card ${css.project}`}>
              {cover ? <img className={css.thumb} src={cover} alt="" /> : <span className={css.thumbEmpty} aria-hidden="true" />}
              <div className={css.projectBody}>
                <span className={css.projectName}>{card.name}</span>
                <span className={css.projectSub}>{card.businessName} · {card.siteAddress}</span>
                <div className={css.badges}>{projectBadges(card).map(b => <Badge key={b.text} tone={b.tone}>{b.text}</Badge>)}</div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
