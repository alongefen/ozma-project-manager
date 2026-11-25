import Link from 'next/link';
import { Card, Notice } from '@/components/ui';
import type { ProjectDetails } from '@/types/contracts';
import { ExtraContacts } from '../contacts/shared/ExtraContacts';
import type { ContactsList } from '../contacts/logic/schemas';
import '../contacts/shared/contacts.css';
import { EditProjectSheet } from '../shared/EditProjectSheet';
import { ProjectActions } from '../shared/ProjectActions';
import { ProjectHardDelete } from '../shared/ProjectHardDelete';
import { valuesFromDetails } from '../shared/form-model';
import { actionsFor, isPlaceholderContact, NOT_ENTERED, coverSrc, dateText, isReadOnlyProject, managersText, orNotEntered, READ_ONLY_NOTICE, telHref } from '../shared/view-model';
import css from './ProjectDetailsDesktop.module.css';

/** Desktop project file: name and status together, permissions at the top for the owner, inner navigation, details and contact (DESIGN S05). */
export function ProjectDetailsDesktop({ d, isOwner, contacts }: { d: ProjectDetails; isOwner: boolean; contacts: ContactsList }) {
  const act = actionsFor(d);
  const cover = coverSrc(d.coverFileId);
  const tel = telHref(d.contact.phone);
  return (
    <div className={`${css.page} d-only`}>
      {act.manage && (
        <div className={css.permRow}>
          <Link href={`/projects/${d.id}/edit/access`} className="ui-btn ui-btn--secondary">הרשאות</Link>
        </div>
      )}
      {isReadOnlyProject(d) && !act.manage && <Notice>{READ_ONLY_NOTICE}</Notice>}
      <div className={css.cols}>
        <div className={css.main}>
          <Card panel className={css.card}>
            <div className={css.cardHead}>
              <h2 className={css.title}>פרטי הפרויקט</h2>
              {act.edit && <EditProjectSheet id={d.id} revision={d.revision} coverFileId={d.coverFileId} isOwner={isOwner} manage={act.manage} initial={valuesFromDetails(d)} />}
            </div>
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
              <div className={css.wide}><dt>הערות</dt><dd className={css.notes}>{orNotEntered(d.accessNotes)}</dd></div>
            </dl>
          </Card>
          {act.manage && (
            <Card panel className={`${css.card} ${css.danger}`}>
              <h2 className={css.dangerTitle}>ניהול מצב הפרויקט</h2>
              <p className={css.dangerText}>פעולות משמעותיות: סיום והעברה לארכיון. שום דבר לא נמחק, ואפשר להחזיר.</p>
              <ProjectActions id={d.id} revision={d.revision} status={d.status} archived={d.archived} />
              <ProjectHardDelete id={d.id} isOwner={isOwner} archived={d.archived} completed={d.status === 'completed'} />
            </Card>
          )}
        </div>
        <Card panel className={css.card}>
          <div className={css.cardHead}>
            <h2 className={css.title}>איש קשר</h2>
            {act.edit && <EditProjectSheet id={d.id} revision={d.revision} coverFileId={d.coverFileId} isOwner={isOwner} manage={act.manage} initial={valuesFromDetails(d)} contactOnly />}
          </div>
          {isPlaceholderContact(d.contact) ? <p>{NOT_ENTERED}</p> : (
<dl className={css.listCol}>
            <div><dt>שם</dt><dd>{d.contact.name}</dd></div>
            <div><dt>תפקיד</dt><dd>{orNotEntered(d.contact.roleTitle)}</dd></div>
            <div><dt>טלפון</dt><dd>{tel ? <a className="ltr" href={tel}>{d.contact.phone}</a> : <span className="ltr">{d.contact.phone}</span>}</dd></div>
            <div><dt>מייל</dt><dd>{d.contact.email ? <a className="ltr" href={`mailto:${d.contact.email}`}>{d.contact.email}</a> : orNotEntered(null)}</dd></div>
          </dl>
          )}
          <ExtraContacts projectId={d.id} initial={contacts} />
        </Card>
      </div>
    </div>
  );
}
