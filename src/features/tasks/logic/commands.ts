import 'server-only';
import type { Platform, RequestContext, Result, Saved, TasksApi } from '@/types/contracts';
import { TasksApiInputSchemas } from '@/types/contracts/tasks';
import { failure } from '@/lib/db/rpc';
import { validate } from './validation';

/** The database takes '' for "no assignee" (JSON null is refused by the shared key check); omitted means unchanged on update. */
function withAssignee<T extends { assigneeId?: string | null }>(input: T) {
  const { assigneeId, ...rest } = input;
  return assigneeId === undefined ? rest : { ...rest, assigneeId: assigneeId ?? '' };
}

export function createTaskCommands(platform: Pick<Platform, 'rpc'>) {
  async function execute<I, O>(ctx: RequestContext, name: string, input: I): Promise<Result<O>> {
    try { return await platform.rpc<I, O>(ctx, name, input); }
    catch { return failure('UNAVAILABLE'); }
  }
  return {
    async createTask(ctx, input) {
      const parsed = validate(TasksApiInputSchemas.createTask, input);
      return parsed.ok ? execute<unknown, Saved>(ctx, 'create_task', withAssignee(parsed.value)) : parsed;
    },
    async updateTask(ctx, input) {
      const parsed = validate(TasksApiInputSchemas.updateTask, input);
      return parsed.ok ? execute<unknown, Saved>(ctx, 'update_task', withAssignee(parsed.value)) : parsed;
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
