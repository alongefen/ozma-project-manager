'use client';
import { Notice } from '@/components/ui';
import { DiaryList } from '../shared/DiaryList';
import { DiaryToolbar } from '../shared/DiaryToolbar';
import type { DiaryScreen } from '../shared/types';

/** Phone (up to 1023): sticky filter and print bar, then the list. The report button is the bottom bar's, not repeated here. */
export function DiaryMobile({ screen }: { screen: DiaryScreen }) {
  return (
    <div className="dr dr-mobile m-only">
      {!screen.canReport && screen.readOnlyNote && <Notice>{screen.readOnlyNote}</Notice>}
      <DiaryToolbar screen={screen} idp="dr-m" underHeader={!screen.fixedProjectId} />
      <DiaryList initial={screen.rows} nextCursor={screen.nextCursor} filter={screen.filter} showProject={!screen.fixedProjectId} />
    </div>
  );
}
