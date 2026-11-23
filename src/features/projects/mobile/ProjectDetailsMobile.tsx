import Link from 'next/link';
import { Badge, Card, Icon, Notice } from '@/components/ui';
import type { ProjectDetails } from '@/types/contracts';
import { ProjectActions } from '../shared/ProjectActions';
import { actionsFor, coverSrc, dateText, isReadOnlyProject, managersText, orNotEntered, READ_ONLY_NOTICE, sectionsFor, statusLabel, telHref } from '../shared/view-model';
import css from './ProjectDetailsMobile.module.css';

/** Phone project file: the entry screen. Large rows lead to the sections, one screen each (UX-19, no tabs). */
export function ProjectDetailsMobile({ d }: { d: ProjectDetails }) {
  const act = actionsFor(d);
  const cover = coverSrc(d.coverFileId);
  const tel = telHref(d.contact.phone);
  return (
    <div className={`${css.page} m-only`}>
      <Link href="/projects" className={css.back}>‹ כל הפרויקטים</Link>
      <header className={css.head}>
        <h2 className={css.name}>{d.name}</h2>
        <Badge tone={d.status === 'completed' || d.archived ? 'gray' : 'active'}>{statusLabel(d)}</Badge>
      </header>
      {isReadOnlyProject(d) && !act.manage && <Notice>{READ_ONLY_NOTICE}</Notice>}
      {cover
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className={css.cover} src={cover} alt="תמונת השער של הפרויקט" />
        : null}
      <Card className={css.card}>
        <h3 className={css.title}>פרטים</h3>
        <dl className={css.list}>
          <div><dt>עסק</dt><dd>{d.businessName}</dd></div>
          <div><dt>כתובת</dt><dd>{d.siteAddress}</dd></div>
          <div><dt>תחילה בפועל</dt><dd>{dateText(d.startDate)}</dd></div>
          <div><dt>סיום בפועל</dt><dd>{dateText(d.endDate)}</dd></div>
          <div><dt>מנהלים</dt><dd>{managersText(d.managerNames)}</dd></div>
          {act.showBusinessNumber && <div><dt>מספר חברה</dt><dd className="ltr">{orNotEntered(d.businessNumber)}</dd></div>}
          <div><dt>הערות</dt><dd className={css.notes}>{orNotEntered(d.accessNotes)}</dd></div>
        </dl>
      </Card>
      <Card className={css.card}>
        <h3 className={css.title}>איש קשר</h3>
        <dl className={css.list}>
          <div><dt>שם</dt><dd>{d.contact.name}</dd></div>
          <div><dt>תפקיד</dt><dd>{orNotEntered(d.contact.roleTitle)}</dd></div>
          <div><dt>טלפון</dt><dd>{tel ? <a className="ltr" href={tel}>{d.contact.phone}</a> : <span className="ltr">{d.contact.phone}</span>}</dd></div>
          <div><dt>מייל</dt><dd>{d.contact.email ? <a className="ltr" href={`mailto:${d.contact.email}`}>{d.contact.email}</a> : orNotEntered(null)}</dd></div>
        </dl>
      </Card>
      <Card className={css.rows}>
        <ul>
          {sectionsFor(d).map(s => (
            <li key={s.key}><Link href={s.href} className={css.row}>{s.label}<Icon name="more" className={css.chev} /></Link></li>
          ))}
        </ul>
      </Card>
      {(act.edit || act.manage) && (
        <div className={css.actions}>
          {act.edit && <Link href={`/projects/${d.id}/edit`} className="ui-btn ui-btn--block">עריכת פרטים</Link>}
          {act.manage && <Link href={`/projects/${d.id}/edit/access`} className="ui-btn ui-btn--secondary ui-btn--block">ניהול הפרויקט ושיוכים</Link>}
          {act.manage && <ProjectActions id={d.id} revision={d.revision} status={d.status} archived={d.archived} />}
        </div>
      )}
    </div>
  );
}
