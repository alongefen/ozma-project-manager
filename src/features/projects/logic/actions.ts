'use server';
import type { ActionsOf, ProjectsApi, Result, RequestContext } from '@/types/contracts';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { createProjectsApi } from './index';
import { hardDelete as runHardDelete, previewHardDelete as runPreview } from './hard-delete';
import type { Deleted, Preview } from './hard-delete';

type Input<K extends keyof ProjectsApi> = Parameters<ProjectsApi[K]>[1];
type Output<K extends keyof ProjectsApi> = Awaited<ReturnType<ProjectsApi[K]>> extends Result<infer O> ? O : never;

async function execute<K extends keyof ProjectsApi>(name: K, input: Input<K>): Promise<Result<Output<K>>> {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return context;
    const operation = createProjectsApi(platform)[name] as (ctx: RequestContext, input: Input<K>) => Promise<Result<Output<K>>>;
    return await operation(context.value, input);
  } catch { return failure('UNAVAILABLE'); }
}

export async function listProjects(input: Input<'listProjects'>) { return execute('listProjects', input); }
export async function getProject(input: Input<'getProject'>) { return execute('getProject', input); }
export async function createProject(input: Input<'createProject'>) { return execute('createProject', input); }
export async function updateProject(input: Input<'updateProject'>) { return execute('updateProject', input); }
export async function setProjectStatus(input: Input<'setProjectStatus'>) { return execute('setProjectStatus', input); }
export async function setProjectArchived(input: Input<'setProjectArchived'>) { return execute('setProjectArchived', input); }
export async function setProjectCover(input: Input<'setProjectCover'>) { return execute('setProjectCover', input); }

// HARD-DELETE (A-44): owner only; the database function refuses everyone else and every active item.
async function owned<T>(run: (ctx: RequestContext) => Promise<Result<T>>): Promise<Result<T>> {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return context;
    return await run(context.value);
  } catch { return failure('UNAVAILABLE'); }
}
export async function previewHardDelete(input: { kind: 'project' | 'document' | 'entry' | 'transaction'; id: string }): Promise<Result<Preview>> { return owned(ctx => runPreview(ctx, input)); }
export async function hardDelete(input: { kind: 'project' | 'document' | 'entry' | 'transaction'; id: string; confirmName?: string }): Promise<Result<Deleted>> { return owned(ctx => runHardDelete(ctx, input)); }

// Compile-time check without exposing a non-async Server Action export.
const actions = { listProjects, getProject, createProject, updateProject, setProjectStatus, setProjectArchived, setProjectCover } satisfies ActionsOf<ProjectsApi>;
void actions;
