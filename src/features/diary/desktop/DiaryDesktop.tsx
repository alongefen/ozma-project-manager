'use client';
import { Button, Card, DesktopTitle, Notice } from '@/components/ui';
import { DiaryList } from '../shared/DiaryList';
import { DiaryToolbar } from '../shared/DiaryToolbar';
import { useDiary } from '../shared/DiaryProvider';
import type { DiaryScreen } from '../shared/types';

/** Desktop (from 1024): title row (top-level diary only; a project tab has none), then a pinned bar with filter, print and the new-report button, then the list. */
export function DiaryDesktop({ screen, title }: { screen: DiaryScreen; title?: string }) {
  const { openNew } = useDiary();
  return (
    <div className="dr dr-desktop d-only">
      {title && <DesktopTitle title={title} />}
      {!screen.canReport && screen.readOnlyNote && <Notice>{screen.readOnlyNote}</Notice>}
      <DiaryToolbar screen={screen} idp="dr-d" lead={screen.canReport ? <Button className="ui-lead" icon="add" onClick={openNew}>דיווח חדש</Button> : undefined} />
      <Card panel>
        <DiaryList filter={screen.filter} showProject={!screen.fixedProjectId} />
      </Card>
    </div>
  );
}
