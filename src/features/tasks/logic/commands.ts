import 'server-only';
import type { Platform, RequestContext, Result, Saved, TasksApi } from '@/types/contracts';
import { TasksApiInputSchemas } from '@/types/contracts/tasks';
import { failure } from '@/lib/db/rpc';
import { validate } from './validation';

export function createTaskCommands(platform: Pick<Platform, 'rpc'>) {
  async function execute<I, O>(ctx: RequestContext, name: string, input: I): Promise<Result<O>> {
    try { return await platform.rpc<I, O>(ctx, name, input); }
    catch { return failure('UNAVAILABLE'); }
  }
  return {
    async createTask(ctx, input) {
      const parsed = validate(TasksApiInputSchemas.createTask, input);
      return parsed.ok ? execute<typeof parsed.value, Saved>(ctx, 'create_task', parsed.value) : parsed;
    },
    async updateTask(ctx, input) {
      const parsed = validate(TasksApiInputSchemas.updateTask, input);
      return parsed.ok ? execute<typeof parsed.value, Saved>(ctx, 'update_task', parsed.value) : parsed;
    },
    async setTaskCompleted(ctx, input) {
      const parsed = validate(TasksApiInputSchemas.setTaskCompleted, input);
      return parsed.ok ? execute<typeof parsed.value, Saved>(ctx, 'set_task_completed', parsed.value) : parsed;
    },
    async deleteTask(ctx, input) {
      const parsed = validate(TasksApiInputSchemas.deleteTask, input);
      return parsed.ok ? execute<typeof parsed.value, null>(ctx, 'delete_task', parsed.value) : parsed;
    },
  } satisfies Omit<TasksApi, 'listTasks'>;
}
