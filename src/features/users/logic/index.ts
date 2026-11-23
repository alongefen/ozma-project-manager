import 'server-only';
import type { Platform, UsersApi } from '@/types/contracts';
import { createUserQueries } from './queries';
import { createUserCommands } from './commands';

export function createUsersApi(platform: Platform): UsersApi {
  return { ...createUserQueries(platform), ...createUserCommands(platform) } satisfies UsersApi;
}
