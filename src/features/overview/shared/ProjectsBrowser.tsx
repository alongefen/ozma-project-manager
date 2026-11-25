'use client';
import { useMemo, useState } from 'react';
import type { ProjectCard } from '@/types/contracts';
import { Notice, Pin, TextField } from '@/components/ui';
import { NewProjectWizard } from '@/features/projects/shared/NewProjectWizard';
import { ProjectList } from './Parts';
import { filterProjects, SHOW_FINISHED_LABEL } from './filter';
import css from './Overview.module.css';

/** Search and status filter over the loaded project cards. No round trip: everything is on the client already. */
export function ProjectsBrowser({ projects, isOwner }: { projects: ProjectCard[]; isOwner: boolean }) {
  const [search, setSearch] = useState('');
  const [showFinished, setShowFinished] = useState(false);
  // Like the documents archive: a switch between the active projects (default) and the finished ones only.
  // Only an owner-level account is offered it (the server sends no finished project to anyone else).
  const finishedView = isOwner && showFinished;
  const status = finishedView ? 'completed' : 'active';
  const finishedCount = useMemo(() => filterProjects(projects, '', 'completed').length, [projects]);
  const inScope = useMemo(() => filterProjects(projects, '', status), [projects, status]);
  const shown = useMemo(() => filterProjects(projects, search, status), [projects, search, status]);
  const filtering = search.trim() !== '';
  return (
    <div className={css.browser}>
      <Pin className={css.tools}>
        <div className={css.search}>
          <TextField label="חיפוש פרויקט, לקוח או כתובת" type="search" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isOwner && <span className={`${css.lead}`}><NewProjectWizard /></span>}
        {isOwner && (
          <button type="button" className={`ui-btn ui-btn--secondary ${css.finished}${finishedView ? ` ${css.finishedOn}` : ''}`} aria-pressed={finishedView} onClick={() => setShowFinished(v => !v)}>
            {SHOW_FINISHED_LABEL}<span className={css.finishedCount}>{finishedCount}</span>
          </button>
        )}
      </Pin>
      {finishedView && <Notice>מוצגים פרויקטים שהסתיימו בלבד. הפרויקטים הפעילים מוסתרים.</Notice>}
      <p className={css.count} aria-live="polite">{filtering ? `${shown.length} מתוך ${inScope.length} פרויקטים` : `${inScope.length} ${finishedView ? 'פרויקטים שהסתיימו' : 'פרויקטים'}`}</p>
      {shown.length === 0 && filtering
        ? <p className={css.empty}>לא נמצאו פרויקטים שמתאימים לחיפוש.</p>
        : shown.length === 0 && finishedView
          ? <p className={css.empty}>אין פרויקטים שהסתיימו.</p>
          : <ProjectList projects={shown} />}
    </div>
  );
}
