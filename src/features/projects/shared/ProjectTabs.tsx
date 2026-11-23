import Link from 'next/link';
import type { Section } from './view-model';
import css from './ProjectTabs.module.css';

/** Phone project sections as tabs under the project name, laid out across the width, current one marked (Alon, 23.11). */
export function ProjectTabs({ projectId, sections, current }: { projectId: string; sections: Section[]; current: 'details' | Section['key'] }) {
  const items = [{ key: 'details', label: 'פרטים', href: `/projects/${projectId}` }, ...sections];
  return (
    <nav className={css.tabs} aria-label="חלקי התיק">
      {items.map(i => (
        <Link key={i.key} href={i.href} className={css.tab} aria-current={i.key === current ? 'page' : undefined}>{i.label}</Link>
      ))}
    </nav>
  );
}
