import Link from 'next/link';
import { DateField, SelectField } from '@/components/ui';
import type { DiaryFilter, ProjectOption } from './model';

/** Plain GET form: the filter lives in the URL, so the server list, back button and sharing all just work. */
export function FilterBar({ filter, projects, action, idp }: { filter: DiaryFilter; projects: ProjectOption[] | null; action: string; idp: string }) {
  return (
    <form className="dr-filter" method="get" action={action}>
      {projects && (
        <SelectField id={`${idp}-project`} name="project" label="פרויקט" defaultValue={filter.projectId ?? ''}
          options={[{ value: '', label: 'כל הפרויקטים' }, ...projects.map(p => ({ value: p.id, label: p.name }))]} />
      )}
      <DateField id={`${idp}-from`} name="from" label="מתאריך" defaultValue={filter.from ?? ''} />
      <DateField id={`${idp}-to`} name="to" label="עד תאריך" defaultValue={filter.to ?? ''} />
      <div className="dr-filter__actions">
        <button type="submit" className="ui-btn ui-btn--secondary">סינון</button>
        {(filter.projectId || filter.from || filter.to) && <Link href={action} className="ui-btn ui-btn--secondary">ניקוי</Link>}
      </div>
    </form>
  );
}
