import type { ReactNode } from 'react';
import { loadProject } from '@/features/projects/shared/load';
import { ProjectFrame } from '@/features/projects/shared/ProjectFrame';

/**
 * Frame shared by the project tabs (details, documents, tasks, diary, finance). New tab routes live in this
 * `(tabs)` group so they keep the frame and slide inside it. The sub-screens (edit, permissions) stay outside.
 */
export default async function ProjectTabsLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project } = await loadProject(id);
  return <ProjectFrame d={project}>{children}</ProjectFrame>;
}
