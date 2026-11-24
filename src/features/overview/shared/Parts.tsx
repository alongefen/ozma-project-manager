import Link from 'next/link';
import type { ReactNode } from 'react';
import type { HomeData, ProjectCard } from '@/types/contracts';
import { Badge, Card } from '@/components/ui';
import { coverSrc } from '@/features/projects/shared/view-model';
import { cubeRows, cubeTitle, counterItems, projectBadges, taskBubble, NO_PROJECTS } from './view-model';
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

/** The finance cube: one wide card with the same top-level cards as the counters. Only when the server sent one (the owner). */
export function Cube({ cube }: { cube: NonNullable<HomeData['financeCube']> }) {
  return (
    <Card className={css.cube}>
      <div className={css.cubeHead}>
        <h2 className={css.cubeTitle}>{cubeTitle(cube)}</h2>
        <Link href="/finance" className={css.cubeLink}>לפירוט התנועות</Link>
      </div>
      <dl className={css.cubeFigures}>
        {cubeRows(cube).map(row => (
          <div key={row.key}><dt>{row.label}</dt><dd className={css.num}>{row.value}</dd></div>
        ))}
      </dl>
    </Card>
  );
}

/** Owner-only "new project" entry (the wizard lives at /projects/new). */
export function NewProjectButton() {
  return <Link href="/projects/new" className="ui-btn">פרויקט חדש</Link>;
}

/**
 * Desktop page title row, the same size and place as the inner-page header (`ui-ph`): title on the right,
 * actions at the far left. The phone shell header already shows the title, so this is desktop only.
 */
export function DesktopTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="ui-ph d-only">
      <div className="ui-ph__row">
        <h1 className="ui-ph__title">{title}</h1>
        {children && <div className="ui-ph__actions">{children}</div>}
      </div>
    </div>
  );
}

export function ProjectList({ projects }: { projects: ProjectCard[] }) {
  if (projects.length === 0) return <Card><p className={css.empty}>{NO_PROJECTS}</p></Card>;
  return (
    <ul className={css.list}>
      {projects.map(card => {
        const cover = coverSrc(card.coverFileId);
        const bubble = taskBubble(card.openTaskCount);
        return (
          <li key={card.id}>
            <Link href={`/projects/${card.id}`} className={`ui-card ${css.project}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {cover ? <img className={css.thumb} src={cover} alt="" /> : <span className={css.thumbEmpty} aria-hidden="true" />}
              <div className={css.projectBody}>
                <span className={css.projectName}>{card.name}</span>
                <span className={css.projectSub}>{card.businessName} · {card.siteAddress}</span>
                <div className={css.badges}>{projectBadges(card).map(b => <Badge key={b.text} tone={b.tone}>{b.text}</Badge>)}</div>
              </div>
              {bubble && (
                <span className={css.tasks} aria-label={bubble.label}>
                  <span className={css.tasksCount}>{bubble.text}</span>
                  <span className={css.tasksLabel}>משימות פתוחות</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
