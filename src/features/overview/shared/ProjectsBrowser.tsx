'use client';
import { useMemo, useState } from 'react';
import type { ProjectCard } from '@/types/contracts';
import { Pin, TextField } from '@/components/ui';
import { NewProjectWizard } from '@/features/projects/shared/NewProjectWizard';
import { ProjectList } from './Parts';
import { filterProjects, SHOW_FINISHED_LABEL } from './filter';
import css from './Overview.module.css';

/** Search and status filter over the loaded project cards. No round trip: everything is on the client already. */
export function ProjectsBrowser({ projects, isOwner }: { projects: ProjectCard[]; isOwner: boolean }) {
  const [search, setSearch] = useState('');
  const [showFinished, setShowFinished] = useState(false);
  // Finished projects are hidden on entry; only an owner-level account is offered the toggle (the server sends no finished project to anyone else).
  const status = isOwner && showFinished ? 'all' : 'active';
  const inScope = useMemo(() => filterProjects(projects, '', status), [projects, status]);
  const shown = useMemo(() => filterProjects(projects, search, status), [projects, search, status]);
  const filtering = search.trim() !== '';
  return (
    <div className={css.browser}>
      <Pin className={css.tools}>
        <div className={css.search}>
          <TextField label="חיפוש פרויקט, לקוח או כתובת" type="search" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isOwner && (
          <div className={css.seg} role="group" aria-label="פרויקטים שהסתיימו">
            <button type="button" aria-pressed={showFinished} onClick={() => setShowFinished(v => !v)}>{SHOW_FINISHED_LABEL}</button>
          </div>
        )}
        {isOwner && <span className={`${css.lead}`}><NewProjectWizard /></span>}
      </Pin>
      <p className={css.count} aria-live="polite">{filtering ? `${shown.length} מתוך ${inScope.length} פרויקטים` : `${inScope.length} פרויקטים`}</p>
      {shown.length === 0 && filtering
        ? <p className={css.empty}>לא נמצאו פרויקטים שמתאימים לחיפוש.</p>
        : <ProjectList projects={shown} />}
    </div>
  );
}
