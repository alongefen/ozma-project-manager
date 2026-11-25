import Link from 'next/link';
import type { HomeData, ProjectCard } from '@/types/contracts';
import { Badge, Card } from '@/components/ui';
import { coverSrc } from '@/features/projects/shared/view-model';
import { counterItems, projectBadges, NO_PROJECTS } from './view-model';
import css from './Overview.module.css';

export function Counters({ counters }: { counters: HomeData['counters'] }) {
  return (
    <div className={css.counters}>
      {counterItems(counters).map(item => {
        const body = (<><span className={css.counterValue}>{item.value}</span><span className={css.counterLabel}>{item.label}</span></>);
        return item.href
          ? <Link key={item.key} href={item.href} className={`ui-card ${css.counter}`}>{body}</Link>
          : <Card key={item.key} className={css.counter}>{body}</Card>;
      })}
    </div>
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
            <div className={`ui-card ${css.project}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {cover ? <img className={css.thumb} src={cover} alt="" /> : <span className={css.thumbEmpty} aria-hidden="true" />}
              <div className={css.projectBody}>
                <Link href={`/projects/${card.id}`} className={css.projectName}>{card.name}</Link>
                <span className={css.projectSub}>{card.businessName} · {card.siteAddress}</span>
                <div className={css.badges}>
                  {projectBadges(card).map(b => <Badge key={b.text} tone={b.tone}>{b.text}</Badge>)}
                  {card.openTaskCount > 0 && (
                    <Link href={`/projects/${card.id}/tasks`} className={css.taskBadge}>{card.openTaskCount} משימות פתוחות</Link>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
