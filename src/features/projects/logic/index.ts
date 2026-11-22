import 'server-only';
import type { Platform, ProjectsApi } from '@/types/contracts';
import { createProjectQueries } from './queries';
import { createProjectCommands } from './commands';

export function createProjectsApi(platform: Platform): ProjectsApi {
  return { ...createProjectQueries(platform), ...createProjectCommands(platform) } satisfies ProjectsApi;
}
