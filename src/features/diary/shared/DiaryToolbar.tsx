'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button, DateField, FilterPopup, Pin, SelectField, Sheet } from '@/components/ui';
import { PrintByDate } from './PrintByDate';
import type { DiaryScreen } from './types';

/**
 * Filter and print-by-date, at the top of the diary log. Sticks to the top of the screen while the list scrolls.
 * The filter is the shared `FilterPopup` (same as finance); the filter lives in the URL, so the server list, back button and sharing work.
 * The badge counts only what the person chose: a project tab's own project is not a filter.
 */
export function DiaryToolbar({ screen, idp, lead }: { screen: DiaryScreen; idp: string; /** Extra pinned action (desktop: new report), placed first (rightmost) in the same bar. */ lead?: ReactNode }) {
  const router = useRouter();
  const [printing, setPrinting] = useState(false);
  const { filter, basePath } = screen;
  const chosenProject = screen.fixedProjectId ? undefined : filter.projectId;
  const count = (chosenProject ? 1 : 0) + (filter.from || filter.to ? 1 : 0);

  function apply(values: FormData) {
    const params = new URLSearchParams();
    for (const key of ['project', 'from', 'to']) {
      const v = values.get(key);
      if (typeof v === 'string' && v) params.set(key, v);
    }
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  return (
    <>
      <Pin className="dr-toolbar">
        {lead && <span className="dr-toolbar__lead">{lead}</span>}
        <FilterPopup title="סינון" count={count} onApply={apply} onClear={() => router.push(basePath)} className="dr-toolbar__filter">
          {screen.projects && !screen.fixedProjectId && (
            <SelectField id={`${idp}-project`} name="project" label="פרויקט" defaultValue={chosenProject ?? ''}
              options={[{ value: '', label: 'כל הפרויקטים' }, ...screen.projects.map(p => ({ value: p.id, label: p.name }))]} />
          )}
          <div className="ui-fhalf"><DateField id={`${idp}-from`} name="from" label="מתאריך" defaultValue={filter.from ?? ''} /></div>
          <div className="ui-fhalf"><DateField id={`${idp}-to`} name="to" label="עד תאריך" defaultValue={filter.to ?? ''} /></div>
        </FilterPopup>
        <Button variant="secondary" onClick={() => setPrinting(true)}>הדפסה וייצוא לפי תאריך</Button>
      </Pin>
      <Sheet open={printing} onClose={() => setPrinting(false)} title="הדפסה וייצוא לפי תאריך">
        <PrintByDate projects={screen.projects ?? []} fixedProjectId={screen.fixedProjectId} today={screen.today} />
      </Sheet>
    </>
  );
}
