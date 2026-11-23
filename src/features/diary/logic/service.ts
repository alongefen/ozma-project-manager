import 'server-only';
import type { DiaryApi, Platform } from '@/types/contracts';
import { createDiaryQueries } from './queries';
import { createDiaryCommands } from './commands';

export function createDiaryApi(platform: Platform): DiaryApi {
  return { ...createDiaryQueries(platform), ...createDiaryCommands(platform) } satisfies DiaryApi;
}
