'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Section } from './view-model';
import { tabIndex, tabItems, type TabItem } from './tab-motion';
import css from './ProjectTabs.module.css';


/** Current tab from the URL, switched at once on click so the highlight never waits for the page. */
function useActive(items: TabItem[]) {
  const pathname = usePathname();
  const [picked, setPicked] = useState<{ href: string; from: string } | null>(null);
  const fromPath = items[tabIndex(pathname, items.map(i => i.href))]?.href;
  const active = picked && picked.from === pathname ? picked.href : fromPath;
  return { active, pick: (href: string) => setPicked({ href, from: pathname }) };
}

/** Phone project sections as tabs under the project name, across the width (Alon, 23.11). */
export function ProjectTabs({ projectId, sections }: { projectId: string; sections: Section[] }) {
  const items = tabItems(projectId, sections);
  const { active, pick } = useActive(items);
  return (
    <nav className={css.tabs} aria-label="חלקי התיק">
      {items.map(i => (
        <Link key={i.key} href={i.href} className={css.tab} aria-current={i.href === active ? 'page' : undefined} onClick={() => pick(i.href)}>{i.label}</Link>
      ))}
    </nav>
  );
}

export { useActive as useActiveTab };
