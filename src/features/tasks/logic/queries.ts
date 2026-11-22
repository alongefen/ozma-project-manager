import 'server-only';
import type { Platform, TaskRow, TasksApi } from '@/types/contracts';
import { TasksApiInputSchemas, TaskRowSchema } from '@/types/contracts/tasks';
import { failure, mapError } from '@/lib/db/rpc';
import { validate } from './validation';

export function createTaskQueries(platform: Pick<Platform, 'permissions' | 'fetchAll'>) {
  return {
    async listTasks(ctx, input) {
      const parsed = validate(TasksApiInputSchemas.listTasks, input);
      if (!parsed.ok) return parsed;
      const { projectId } = parsed.value;
      try {
        const permission = await platform.permissions.forProject(ctx, { projectId });
        if (!permission.ok) return permission;
        if (!permission.value.view) return failure('NOT_FOUND');
        const countTasks = async (completed: boolean) => {
          const { count, error } = await ctx.db.from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId).is('deleted_at', null).eq('completed', completed);
          if (error) throw error;
          if (count === null) throw new Error('Missing task count');
          return count;
        };
        const [rows, openCount, completedCount] = await Promise.all([
          platform.fetchAll(async (from, to) => {
            const { data, error } = await ctx.db.from('tasks')
              .select('id,project_id,body,completed,due_date,created_at,revision')
              .eq('project_id', projectId).is('deleted_at', null)
              .order('created_at', { ascending: false }).order('id', { ascending: false })
              .range(from, to);
            if (error) throw error;
            if (data === null) throw new Error('Missing task rows');
            return data.map(row => TaskRowSchema.parse({
              id: row.id, projectId: row.project_id, body: row.body, completed: row.completed,
              dueDate: row.due_date, createdAt: row.created_at, revision: row.revision,
            }));
          }),
          countTasks(false), countTasks(true),
        ]);
        const open: TaskRow[] = [];
        const completed: TaskRow[] = [];
        for (const row of rows) (row.completed ? completed : open).push(row);
        return { ok: true, value: { open, completed, openCount, completedCount, canWrite: permission.value.writeTasks } };
      } catch (error) { return { ok: false, error: mapError(error) }; }
    },
  } satisfies Pick<TasksApi, 'listTasks'>;
}
