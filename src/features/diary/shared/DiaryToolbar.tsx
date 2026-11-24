'use client';
import { useState, type ReactNode } from 'react';
import { Button, Pin, Sheet } from '@/components/ui';
import { FilterBar } from './FilterBar';
import { PrintByDate } from './PrintByDate';
import type { DiaryScreen } from './types';

/**
 * Filter and print-by-date, at the top of the diary log. Sticks to the top of the screen while the list scrolls.
 * Each opens in the shared sheet (bottom sheet on the phone, centred window on desktop).
 */
export function DiaryToolbar({ screen, idp, lead }: { screen: DiaryScreen; idp: string; /** Extra pinned action (desktop: new report), placed at the far end of the same bar. */ lead?: ReactNode }) {
  const [open, setOpen] = useState<'filter' | 'print' | null>(null);
  const { filter } = screen;
  const active = (filter.projectId ? 1 : 0) + (filter.from || filter.to ? 1 : 0);
  return (
    <>
      <Pin className="dr-toolbar">
        <Button variant="secondary" onClick={() => setOpen('filter')}>סינון{active > 0 && <span className="dr-toolbar__count">{active}</span>}</Button>
        <Button variant="secondary" onClick={() => setOpen('print')}>הדפסה / PDF לפי תאריך</Button>
        {lead && <span className="dr-toolbar__lead">{lead}</span>}
      </Pin>
      <Sheet open={open === 'filter'} onClose={() => setOpen(null)} title="סינון הדיווחים">
        <FilterBar idp={`${idp}-f`} filter={filter} projects={screen.projects} action={screen.basePath} />
      </Sheet>
      <Sheet open={open === 'print'} onClose={() => setOpen(null)} title="הדפסה או PDF לפי תאריך">
        <PrintByDate projects={screen.projects ?? []} fixedProjectId={screen.fixedProjectId} today={screen.today} />
      </Sheet>
    </>
  );
}
