import 'server-only';
import type { Platform, TaskAssignee, TaskRow, TasksApi } from '@/types/contracts';
import { TasksApiInputSchemas, TaskRowSchema } from '@/types/contracts/tasks';
import { failure, mapError } from '@/lib/db/rpc';
import { validate } from './validation';
import { untypedDb } from '@/features/projects/logic/untyped-db';

type TaskDbRow = { id: string; project_id: string; body: string; completed: boolean; due_date: string | null; created_at: string; revision: number; assignee_id: string | null };

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
        const loadAssignees = async (): Promise<TaskAssignee[]> => {
          const { data, error } = await untypedDb(ctx).rpc('list_project_assignees', { p: projectId });
          if (error) throw error;
          return ((data ?? []) as { user_id: string; full_name: string; role: TaskAssignee['role'] }[])
            .map(row => ({ id: row.user_id, name: row.full_name, role: row.role }));
        };
        const [rows, openCount, completedCount, assignees] = await Promise.all([
          platform.fetchAll(async (from, to) => {
            const { data, error } = await untypedDb(ctx).from('tasks')
              .select('id,project_id,body,completed,due_date,created_at,revision,assignee_id')
              .eq('project_id', projectId).is('deleted_at', null)
              .order('created_at', { ascending: false }).order('id', { ascending: false })
              .range(from, to);
            if (error) throw error;
            if (data === null) throw new Error('Missing task rows');
            return (data as TaskDbRow[]).map(row => TaskRowSchema.parse({
              id: row.id, projectId: row.project_id, body: row.body, completed: row.completed,
              dueDate: row.due_date, createdAt: row.created_at, revision: row.revision,
              assigneeId: row.assignee_id, assigneeName: null,
            }));
          }),
          countTasks(false), countTasks(true), loadAssignees(),
        ]);
        // Names come from the members read; a person who left the project keeps the id but has no name.
        const names = new Map(assignees.map(a => [a.id, a.name]));
        const open: TaskRow[] = [];
        const completed: TaskRow[] = [];
        for (const row of rows) (row.completed ? completed : open).push(row.assigneeId ? { ...row, assigneeName: names.get(row.assigneeId) ?? null } : row);
        return { ok: true, value: { open, completed, openCount, completedCount, canWrite: permission.value.writeTasks, assignees } };
      } catch (error) { return { ok: false, error: mapError(error) }; }
    },
  } satisfies Pick<TasksApi, 'listTasks'>;
}
