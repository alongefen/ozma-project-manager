import Link from 'next/link';
import { Badge, Card, Notice } from '@/components/ui';
import type { ProjectDetails } from '@/types/contracts';
import { BackTitle } from '../shared/BackTitle';
import { EditProjectSheet } from '../shared/EditProjectSheet';
import { ProjectActions } from '../shared/ProjectActions';
import { ProjectTabs } from '../shared/ProjectTabs';
import { valuesFromDetails } from '../shared/form-model';
import { actionsFor, coverSrc, dateText, isReadOnlyProject, managersText, orNotEntered, READ_ONLY_NOTICE, sectionsFor, statusLabel, telHref } from '../shared/view-model';
import css from './ProjectDetailsMobile.module.css';

/**
 * Phone project file: name with its status, permissions button for the owner, section tabs across the
 * width, then details in two columns. Editing opens a bottom sheet (Alon, 23.11).
 */
export function ProjectDetailsMobile({ d, isOwner }: { d: ProjectDetails; isOwner: boolean }) {
  const act = actionsFor(d);
  const cover = coverSrc(d.coverFileId);
  const tel = telHref(d.contact.phone);
  return (
    <div className={`${css.page} m-only`}>
      <BackTitle
        title={d.name} backHref="/projects" backLabel="חזרה לרשימת הפרויקטים"
        badge={<Badge tone={d.status === 'completed' || d.archived ? 'gray' : 'active'}>{statusLabel(d)}</Badge>}
        actions={act.manage ? <Link href={`/projects/${d.id}/edit/access`} className={css.perm}>הרשאות</Link> : undefined}
      />
      <ProjectTabs projectId={d.id} sections={sectionsFor(d)} current="details" />
      {isReadOnlyProject(d) && !act.manage && <Notice>{READ_ONLY_NOTICE}</Notice>}
      {cover
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className={css.cover} src={cover} alt="תמונת השער של הפרויקט" />
        : null}
      <Card className={css.card}>
        <div className={css.cardHead}>
          <h3 className={css.title}>פרטי הפרויקט</h3>
          {act.edit && <EditProjectSheet id={d.id} revision={d.revision} coverFileId={d.coverFileId} isOwner={isOwner} manage={act.manage} initial={valuesFromDetails(d)} icon />}
        </div>
        <dl className={css.list}>
          <div><dt>עסק</dt><dd>{d.businessName}</dd></div>
          <div><dt>מנהלים</dt><dd>{managersText(d.managerNames)}</dd></div>
          <div className={css.wide}><dt>כתובת</dt><dd>{d.siteAddress}</dd></div>
          <div><dt>תחילה בפועל</dt><dd>{dateText(d.startDate)}</dd></div>
          <div><dt>סיום בפועל</dt><dd>{dateText(d.endDate)}</dd></div>
          {act.showBusinessNumber && <div><dt>מספר חברה</dt><dd><span className="ltr">{orNotEntered(d.businessNumber)}</span></dd></div>}
          <div className={css.wide}><dt>הערות</dt><dd className={css.notes}>{orNotEntered(d.accessNotes)}</dd></div>
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
      {act.manage && (
        <Card className={`${css.card} ${css.danger}`}>
          <h3 className={css.dangerTitle}>ניהול מצב הפרויקט</h3>
          <p className={css.dangerText}>פעולות משמעותיות: סיום והעברה לארכיון. שום דבר לא נמחק, ואפשר להחזיר.</p>
          <ProjectActions id={d.id} revision={d.revision} status={d.status} archived={d.archived} />
        </Card>
      )}
    </div>
  );
}
