import 'server-only';
import type { Platform, RequestContext } from '@/types/contracts';
import { createProjectsApi } from '@/features/projects/logic';
import { createDiaryApi } from '../logic';
import { loadProject } from '@/features/projects/shared/load';
import { READ_ONLY_NOTICE, isReadOnlyProject } from '@/features/projects/shared/view-model';
import type { DiaryScreen } from './types';
import type { DiaryFilter, ProjectOption } from './model';

/** Active projects the viewer may report on. The permission is the server's (`report`), never guessed in the view. */
export async function loadReportableProjects(platform: Platform, ctx: RequestContext): Promise<ProjectOption[] | null> {
  const list = await createProjectsApi(platform).listProjects(ctx, { status: 'active', archived: false });
  if (!list.ok) return null;
  const checked = await Promise.all(list.value.map(async p => {
    const perm = await platform.permissions.forProject(ctx, { projectId: p.id });
    return perm.ok && perm.value.report ? { id: p.id, name: p.name } : null;
  }));
  return checked.filter((p): p is ProjectOption => p !== null);
}

/** All projects the viewer can see, for the filter and the print picker (read-only projects included). */
export async function loadVisibleProjects(platform: Platform, ctx: RequestContext): Promise<ProjectOption[] | null> {
  const [active, done] = await Promise.all([
    createProjectsApi(platform).listProjects(ctx, { archived: false }),
    createProjectsApi(platform).listProjects(ctx, { archived: true }),
  ]);
  if (!active.ok) return null;
  const all = [...active.value, ...(done.ok ? done.value : [])];
  return all.map(p => ({ id: p.id, name: p.name }));
}

export type DiaryLoad =
  | { kind: 'ok'; screen: DiaryScreen }
  | { kind: 'hidden' } | { kind: 'signed-out' } | { kind: 'error' };

/** Reads one page of the diary for the general screen (all visible projects) or one project, plus what the form needs. */
export async function loadDiaryScreen(platform: Platform, ctx: RequestContext, opts: { projectId?: string; filter: DiaryFilter; basePath: string }): Promise<DiaryLoad> {
  const filter = opts.projectId ? { ...opts.filter, projectId: opts.projectId } : opts.filter;
  const [page, projects, reportable, project] = await Promise.all([
    createDiaryApi(platform).listEntries(ctx, filter),
    opts.projectId ? Promise.resolve(null) : loadVisibleProjects(platform, ctx),
    opts.projectId ? Promise.resolve(null) : loadReportableProjects(platform, ctx),
    // Memoised per request: the project tab layout already read it.
    opts.projectId ? loadProject(opts.projectId) : Promise.resolve(null),
  ]);
  if (!page.ok) {
    const code = page.error.code;
    if (code === 'UNAUTHENTICATED') return { kind: 'signed-out' };
    if (code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'VALIDATION') return { kind: 'hidden' };
    return { kind: 'error' };
  }
  if (!opts.projectId && !reportable) return { kind: 'error' };
  const canReport = project ? project.project.permissions.report && !isReadOnlyProject(project.project) : (reportable?.length ?? 0) > 0;
  const formProjects = project ? (canReport ? [{ id: project.project.id, name: project.project.name }] : []) : reportable ?? [];
  return { kind: 'ok', screen: {
    rows: page.value.items, nextCursor: page.value.nextCursor, filter, projects,
    fixedProjectId: opts.projectId, canReport, formProjects, isOwner: ctx.actor.isOwner,
    readOnlyNote: canReport ? undefined : READ_ONLY_NOTICE,
    today: ctx.today, basePath: opts.basePath,
  } };
}
