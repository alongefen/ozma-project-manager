'use client';
import { useMemo, useState } from 'react';
import type { ProjectCard } from '@/types/contracts';
import { Pin, TextField } from '@/components/ui';
import { NewProjectWizard } from '@/features/projects/shared/NewProjectWizard';
import { ProjectList } from './Parts';
import { filterProjects, STATUS_OPTIONS, type StatusFilter } from './filter';
import css from './Overview.module.css';

/** Search and status filter over the loaded project cards. No round trip: everything is on the client already. */
export function ProjectsBrowser({ projects, isOwner }: { projects: ProjectCard[]; isOwner: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const shown = useMemo(() => filterProjects(projects, search, status), [projects, search, status]);
  const filtering = search.trim() !== '' || status !== 'all';
  return (
    <div className={css.browser}>
      <Pin className={css.tools}>
        <div className={css.search}>
          <TextField label="חיפוש פרויקט, לקוח או כתובת" type="search" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className={css.seg} role="group" aria-label="סינון לפי סטטוס">
          {STATUS_OPTIONS.map(o => (
            <button key={o.value} type="button" aria-pressed={status === o.value} onClick={() => setStatus(o.value)}>{o.label}</button>
          ))}
        </div>
        {isOwner && <span className={`${css.lead}`}><NewProjectWizard /></span>}
      </Pin>
      <p className={css.count} aria-live="polite">{filtering ? `${shown.length} מתוך ${projects.length} פרויקטים` : `${projects.length} פרויקטים`}</p>
      {shown.length === 0 && filtering
        ? <p className={css.empty}>לא נמצאו פרויקטים שמתאימים לחיפוש.</p>
        : <ProjectList projects={shown} />}
    </div>
  );
}
