'use client';
import Link from 'next/link';
import type { Section } from './view-model';
import { useActiveTab } from './ProjectTabs';
import { tabItems } from './tab-motion';
import css from './ProjectInnerNav.module.css';

/** Desktop project sections as tabs under the project name. Same tabs and same highlight rule as the phone. */
export function ProjectInnerNav({ projectId, sections }: { projectId: string; sections: Section[] }) {
  const items = tabItems(projectId, sections);
  const { active, pick } = useActiveTab(items);
  return (
    <nav className={css.inner} aria-label="חלקי התיק">
      {items.map(i => (
        <Link key={i.key} href={i.href} aria-current={i.href === active ? 'page' : undefined} onClick={() => pick(i.href)}>{i.label}</Link>
      ))}
    </nav>
  );
}
