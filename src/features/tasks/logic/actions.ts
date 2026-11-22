'use server';
import type { RequestContext, Result, TasksApi } from '@/types/contracts';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { createTasksApi } from './index';

async function withTasks<T>(operation: (api: TasksApi, ctx: RequestContext) => Promise<Result<T>>): Promise<Result<T>> {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return context;
    return await operation(createTasksApi(platform), context.value);
  } catch { return failure('UNAVAILABLE'); }
}

export async function listTasks(input: Parameters<TasksApi['listTasks']>[1]) {
  return withTasks((api, ctx) => api.listTasks(ctx, input));
}
export async function createTask(input: Parameters<TasksApi['createTask']>[1]) {
  return withTasks((api, ctx) => api.createTask(ctx, input));
}
export async function updateTask(input: Parameters<TasksApi['updateTask']>[1]) {
  return withTasks((api, ctx) => api.updateTask(ctx, input));
}
export async function setTaskCompleted(input: Parameters<TasksApi['setTaskCompleted']>[1]) {
  return withTasks((api, ctx) => api.setTaskCompleted(ctx, input));
}
export async function deleteTask(input: Parameters<TasksApi['deleteTask']>[1]) {
  return withTasks((api, ctx) => api.deleteTask(ctx, input));
}
