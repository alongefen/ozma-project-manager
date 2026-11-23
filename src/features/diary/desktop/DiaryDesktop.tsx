import Link from 'next/link';
import { Card, Notice } from '@/components/ui';
import { DiaryList } from '../shared/DiaryList';
import { FilterBar } from '../shared/FilterBar';
import { PrintByDate } from '../shared/PrintByDate';
import { REPORT_PATH } from '@/lib/navigation';
import type { DiaryScreen } from '../shared/types';

/** Desktop (from 1024): the list on the right, filter and print by date in a side column on the left. */
export function DiaryDesktop({ screen, title }: { screen: DiaryScreen; title: string }) {
  const { fixedProjectId, projects } = screen;
  const newHref = fixedProjectId ? `${REPORT_PATH}?project=${fixedProjectId}` : REPORT_PATH;
  return (
    <div className="dr dr-desktop d-only">
      <div className="dr-bar">
        <h2 className="dr-bar__title">{title}</h2>
        {screen.canReport && <Link href={newHref} className="ui-btn">+ דיווח חדש</Link>}
      </div>
      {!screen.canReport && screen.readOnlyNote && <Notice>{screen.readOnlyNote}</Notice>}
      <div className="dr-desktop__grid">
        <Card panel>
          <DiaryList initial={screen.rows} nextCursor={screen.nextCursor} filter={screen.filter} showProject={!fixedProjectId} />
        </Card>
        <aside className="dr-side">
          <Card panel>
            <h3 className="dr-section-title">סינון</h3>
            <FilterBar idp="dr-d-f" filter={screen.filter} projects={projects} action={screen.basePath} />
          </Card>
          <Card panel>
            <h3 className="dr-section-title">הדפסה או PDF לפי תאריך</h3>
            <PrintByDate projects={projects ?? []} fixedProjectId={fixedProjectId} today={screen.today} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
