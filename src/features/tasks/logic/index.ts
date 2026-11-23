import 'server-only';
import type { Platform, TasksApi } from '@/types/contracts';
import { createTaskQueries } from './queries';
import { createTaskCommands } from './commands';

export function createTasksApi(platform: Platform): TasksApi {
  return { ...createTaskQueries(platform), ...createTaskCommands(platform) } satisfies TasksApi;
}
