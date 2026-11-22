'use server';
import type { ActionsOf, ProjectsApi, Result, RequestContext } from '@/types/contracts';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { createProjectsApi } from './index';

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

// Compile-time check without exposing a non-async Server Action export.
const actions = { listProjects, getProject, createProject, updateProject, setProjectStatus, setProjectArchived, setProjectCover } satisfies ActionsOf<ProjectsApi>;
void actions;
