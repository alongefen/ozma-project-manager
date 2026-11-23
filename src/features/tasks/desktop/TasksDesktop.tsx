'use client';
import { Button, Card, Notice } from '@/components/ui';
import { TaskGroup } from '../shared/TaskGroup';
import { useTasks } from '../shared/TasksProvider';

/** Desktop (from 1024): title row with the new-note button, then two groups stacked, each a grid of note cards. */
export function TasksDesktop() {
  const { lists, canWrite, openCreate } = useTasks();
  return (
    <div className="tk tk-desktop d-only">
      <div className="tk-bar">
        <h2 className="tk-bar__title">משימות</h2>
        {canWrite && <Button onClick={openCreate}>+ משימה חדשה</Button>}
      </div>
      {!canWrite && <Notice>הפרויקט זמין לצפייה והדפסה בלבד.</Notice>}
      <Card panel><TaskGroup headingId="tk-d-open" title="לביצוע" tasks={lists.open} empty="אין משימות לביצוע" /></Card>
      <Card panel><TaskGroup headingId="tk-d-done" title="בוצעו" tasks={lists.completed} empty="עוד אין משימות שבוצעו" /></Card>
    </div>
  );
}
