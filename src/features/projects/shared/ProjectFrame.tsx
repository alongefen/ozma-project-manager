import type { ReactNode } from 'react';
import { Badge, PageHeader } from '@/components/ui';
import type { ProjectDetails } from '@/types/contracts';
import { ProjectInnerNav } from './ProjectInnerNav';
import { ProjectTabs } from './ProjectTabs';
import { tabItems } from './tab-motion';
import { TabSlide } from './TabSlide';
import { sectionsFor, statusLabel } from './view-model';
import css from './ProjectFrame.module.css';

/**
 * The fixed frame of every project tab: back, name, status, and the tabs, all pinned to the top while the tab content scrolls. It lives in the
 * layout, so it stays put while only the content below it changes and slides (DESIGN 3.5).
 */
export function ProjectFrame({ d, children }: { d: ProjectDetails; children: ReactNode }) {
  const sections = sectionsFor(d);
  return (
    <div className={css.frame}>
      <PageHeader
        title={d.name} backHref="/projects" backLabel="חזרה לרשימת הפרויקטים"
        badge={<Badge tone={d.status === 'completed' || d.archived ? 'gray' : 'active'}>{statusLabel(d)}</Badge>}
      >
        <p className={`ui-sub d-only ${css.address}`}>{d.siteAddress}</p>
        <div className="m-only"><ProjectTabs projectId={d.id} sections={sections} /></div>
        <div className="d-only"><ProjectInnerNav projectId={d.id} sections={sections} /></div>
      </PageHeader>
      <TabSlide hrefs={tabItems(d.id, sections).map(i => i.href)}>{children}</TabSlide>
    </div>
  );
}
