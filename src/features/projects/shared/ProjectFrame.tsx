import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui';
import type { ProjectDetails } from '@/types/contracts';
import { BackTitle } from './BackTitle';
import { ProjectInnerNav } from './ProjectInnerNav';
import { ProjectTabs } from './ProjectTabs';
import { tabItems } from './tab-motion';
import { TabSlide } from './TabSlide';
import { actionsFor, sectionsFor, statusLabel } from './view-model';
import css from './ProjectFrame.module.css';

/**
 * The fixed frame of every project tab: back, name, status, permissions and the tabs. It lives in the
 * layout, so it stays put while only the content below it changes and slides (DESIGN 3.5).
 */
export function ProjectFrame({ d, children }: { d: ProjectDetails; children: ReactNode }) {
  const act = actionsFor(d);
  const sections = sectionsFor(d);
  return (
    <div className={css.frame}>
      <div>
        <BackTitle
          title={d.name} backHref="/projects" backLabel="חזרה לרשימת הפרויקטים"
          badge={<Badge tone={d.status === 'completed' || d.archived ? 'gray' : 'active'}>{statusLabel(d)}</Badge>}
          actions={act.manage ? <Link href={`/projects/${d.id}/edit/access`} className="ui-btn ui-btn--secondary">הרשאות</Link> : undefined}
        />
        <p className={`ui-sub d-only ${css.address}`}>{d.siteAddress}</p>
      </div>
      <div className="m-only"><ProjectTabs projectId={d.id} sections={sections} /></div>
      <div className="d-only"><ProjectInnerNav projectId={d.id} sections={sections} /></div>
      <TabSlide hrefs={tabItems(d.id, sections).map(i => i.href)}>{children}</TabSlide>
    </div>
  );
}
