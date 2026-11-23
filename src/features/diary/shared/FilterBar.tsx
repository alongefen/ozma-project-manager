import Link from 'next/link';
import type { DiaryFilter, ProjectOption } from './model';

/** Plain GET form: the filter lives in the URL, so the server list, back button and sharing all just work. */
export function FilterBar({ filter, projects, action, idp }: { filter: DiaryFilter; projects: ProjectOption[] | null; action: string; idp: string }) {
  return (
    <form className="dr-filter" method="get" action={action}>
      {projects && (
        <div className="ui-field">
          <label className="ui-field__label" htmlFor={`${idp}-project`}>פרויקט</label>
          <select id={`${idp}-project`} name="project" className="ui-field__input" defaultValue={filter.projectId ?? ''}>
            <option value="">כל הפרויקטים</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      <div className="ui-field">
        <label className="ui-field__label" htmlFor={`${idp}-from`}>מתאריך</label>
        <input id={`${idp}-from`} name="from" type="date" dir="ltr" className="ui-field__input" defaultValue={filter.from ?? ''} />
      </div>
      <div className="ui-field">
        <label className="ui-field__label" htmlFor={`${idp}-to`}>עד תאריך</label>
        <input id={`${idp}-to`} name="to" type="date" dir="ltr" className="ui-field__input" defaultValue={filter.to ?? ''} />
      </div>
      <div className="dr-filter__actions">
        <button type="submit" className="ui-btn ui-btn--secondary">סינון</button>
        {(filter.projectId || filter.from || filter.to) && <Link href={action} className="ui-btn ui-btn--secondary">ניקוי</Link>}
      </div>
    </form>
  );
}
