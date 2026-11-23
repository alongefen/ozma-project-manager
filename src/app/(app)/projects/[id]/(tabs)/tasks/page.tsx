import { notFound, redirect } from 'next/navigation';
import { getContext, getPlatform } from '@/components/shell/request';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { StateMessage } from '@/components/ui';
import { createTasksApi } from '@/features/tasks/logic';
import { TasksProvider } from '@/features/tasks/shared/TasksProvider';
import { TasksMobile } from '@/features/tasks/mobile/TasksMobile';
import { TasksDesktop } from '@/features/tasks/desktop/TasksDesktop';
import '@/features/tasks/shared/tasks.css';

export const metadata = { title: 'משימות' };

/** Tasks of one project: two groups, tick to complete. Write controls follow the live permission; the database decides. */
export default async function ProjectTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [platform, context] = await Promise.all([getPlatform(), getContext()]);
  if (!context.ok) redirect(SIGN_IN_PATH);
  const result = await createTasksApi(platform).listTasks(context.value, { projectId: id });
  if (!result.ok) {
    const code = result.error.code;
    if (code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'VALIDATION') notFound();
    if (code === 'UNAUTHENTICATED') redirect(SIGN_IN_PATH);
    return <StateMessage tone="error" backHref={`/projects/${id}`} backLabel="חזרה לתיק הפרויקט">המשימות אינן זמינות כרגע. נסו שוב בעוד רגע.</StateMessage>;
  }
  const { open, completed, canWrite } = result.value;
  return (
    <TasksProvider projectId={id} initial={{ open, completed }} canWrite={canWrite} canDelete={canWrite && context.value.actor.isOwner} today={context.value.today}>
      <TasksMobile />
      <TasksDesktop />
    </TasksProvider>
  );
}
