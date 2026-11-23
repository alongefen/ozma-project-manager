import Link from 'next/link';
import type { Section } from './view-model';
import css from './ProjectInnerNav.module.css';

/** Desktop project sections as tabs under the project name. One component for every project screen (DESIGN 3.4). */
export function ProjectInnerNav({ projectId, sections, current }: { projectId: string; sections: Section[]; current: 'details' | Section['key'] }) {
  const items = [{ key: 'details', label: 'פרטים', href: `/projects/${projectId}` }, ...sections];
  return (
    <nav className={css.inner} aria-label="חלקי התיק">
      {items.map(i => (
        <Link key={i.key} href={i.href} aria-current={i.key === current ? 'page' : undefined}>{i.label}</Link>
      ))}
    </nav>
  );
}
