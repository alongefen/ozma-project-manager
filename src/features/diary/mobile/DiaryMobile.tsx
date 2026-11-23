'use client';
import { Button, Notice } from '@/components/ui';
import { DiaryList } from '../shared/DiaryList';
import { FilterBar } from '../shared/FilterBar';
import { PrintByDate } from '../shared/PrintByDate';
import { useDiary } from '../shared/DiaryProvider';
import type { DiaryScreen } from '../shared/types';

/** Phone (up to 1023): one column. New-report button on top, filter and print folded, then the list. No tabs, no side panel. */
export function DiaryMobile({ screen }: { screen: DiaryScreen }) {
  const { fixedProjectId, projects } = screen;
  const { openNew } = useDiary();
  return (
    <div className="dr dr-mobile m-only">
      {screen.canReport
        ? <Button block onClick={openNew}>דיווח חדש</Button>
        : screen.readOnlyNote ? <Notice>{screen.readOnlyNote}</Notice> : null}
      <details className="dr-fold">
        <summary>סינון</summary>
        <div><FilterBar idp="dr-m-f" filter={screen.filter} projects={projects} action={screen.basePath} /></div>
      </details>
      <details className="dr-fold">
        <summary>הדפסה או PDF לפי תאריך</summary>
        <div><PrintByDate projects={projects ?? []} fixedProjectId={fixedProjectId} today={screen.today} /></div>
      </details>
      <DiaryList initial={screen.rows} nextCursor={screen.nextCursor} filter={screen.filter} showProject={!fixedProjectId} />
    </div>
  );
}
