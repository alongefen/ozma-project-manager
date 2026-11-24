'use client';
import { Button, Card, Notice, Pin } from '@/components/ui';
import { DiaryList } from '../shared/DiaryList';
import { DiaryToolbar } from '../shared/DiaryToolbar';
import { useDiary } from '../shared/DiaryProvider';
import type { DiaryScreen } from '../shared/types';

/** Desktop (from 1024): title row with the new-report button, a sticky filter and print bar, then the list. */
export function DiaryDesktop({ screen, title }: { screen: DiaryScreen; title: string }) {
  const { openNew } = useDiary();
  return (
    <div className="dr dr-desktop d-only">
      <Pin className="dr-bar">
        <h2 className="dr-bar__title">{title}</h2>
        {screen.canReport && <Button onClick={openNew}>+ דיווח חדש</Button>}
      </Pin>
      {!screen.canReport && screen.readOnlyNote && <Notice>{screen.readOnlyNote}</Notice>}
      <DiaryToolbar screen={screen} idp="dr-d" />
      <Card panel>
        <DiaryList initial={screen.rows} nextCursor={screen.nextCursor} filter={screen.filter} showProject={!screen.fixedProjectId} />
      </Card>
    </div>
  );
}
