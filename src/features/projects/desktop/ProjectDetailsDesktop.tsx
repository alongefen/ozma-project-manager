import Link from 'next/link';
import { Badge, Card, Notice } from '@/components/ui';
import type { ProjectDetails } from '@/types/contracts';
import { ProjectActions } from '../shared/ProjectActions';
import { actionsFor, coverSrc, dateText, isReadOnlyProject, managersText, orNotEntered, READ_ONLY_NOTICE, sectionsFor, statusLabel, telHref } from '../shared/view-model';
import css from './ProjectDetailsDesktop.module.css';

/** Desktop project file: header, inner navigation, wide details card and narrow contact card (DESIGN S05). */
export function ProjectDetailsDesktop({ d }: { d: ProjectDetails }) {
  const act = actionsFor(d);
  const cover = coverSrc(d.coverFileId);
  const tel = telHref(d.contact.phone);
  return (
    <div className={`${css.page} d-only`}>
      <Link href="/projects" className={css.back}>‹ חזרה לפרויקטים</Link>
      <header className={css.head}>
        <div>
          <h1 className="ui-page-title">{d.name}</h1>
          <p className="ui-sub">{d.siteAddress}</p>
        </div>
        <div className={css.headSide}>
          <Badge tone={d.status === 'completed' || d.archived ? 'gray' : 'active'}>{statusLabel(d)}</Badge>
          {act.edit && <Link href={`/projects/${d.id}/edit`} className="ui-btn">עריכת פרטים</Link>}
          {act.manage && <Link href={`/projects/${d.id}/edit/access`} className="ui-btn ui-btn--secondary">שיוכים</Link>}
        </div>
      </header>
      <nav className={css.inner} aria-label="חלקי התיק">
        <span className={css.current} aria-current="page">פרטים</span>
        {sectionsFor(d).map(s => <Link key={s.key} href={s.href}>{s.label}</Link>)}
      </nav>
      {isReadOnlyProject(d) && !act.manage && <Notice>{READ_ONLY_NOTICE}</Notice>}
      <div className={css.cols}>
        <Card panel className={css.card}>
          <h2 className={css.title}>פרטי הפרויקט</h2>
          {cover
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className={css.cover} src={cover} alt="תמונת השער של הפרויקט" />
            : null}
          <dl className={css.list}>
            <div><dt>עסק</dt><dd>{d.businessName}</dd></div>
            <div><dt>כתובת</dt><dd>{d.siteAddress}</dd></div>
            <div><dt>תחילה בפועל</dt><dd>{dateText(d.startDate)}</dd></div>
            <div><dt>סיום בפועל</dt><dd>{dateText(d.endDate)}</dd></div>
            <div><dt>מנהלים</dt><dd>{managersText(d.managerNames)}</dd></div>
            {act.showBusinessNumber && <div><dt>מספר חברה</dt><dd className="ltr">{orNotEntered(d.businessNumber)}</dd></div>}
            <div className={css.wide}><dt>הערות</dt><dd className={css.notes}>{orNotEntered(d.accessNotes)}</dd></div>
          </dl>
        </Card>
        <div className={css.side}>
          <Card panel className={css.card}>
            <h2 className={css.title}>איש קשר</h2>
            <dl className={css.listCol}>
              <div><dt>שם</dt><dd>{d.contact.name}</dd></div>
              <div><dt>תפקיד</dt><dd>{orNotEntered(d.contact.roleTitle)}</dd></div>
              <div><dt>טלפון</dt><dd>{tel ? <a className="ltr" href={tel}>{d.contact.phone}</a> : <span className="ltr">{d.contact.phone}</span>}</dd></div>
              <div><dt>מייל</dt><dd>{d.contact.email ? <a className="ltr" href={`mailto:${d.contact.email}`}>{d.contact.email}</a> : orNotEntered(null)}</dd></div>
            </dl>
          </Card>
          {act.manage && (
            <Card panel className={css.card}>
              <h2 className={css.title}>ניהול מצב</h2>
              <ProjectActions id={d.id} revision={d.revision} status={d.status} archived={d.archived} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
