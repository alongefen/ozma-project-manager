'use client';
import { useState } from 'react';
import { Button, Notice, Pin } from '@/components/ui';
import { TaskGroup } from '../shared/TaskGroup';
import { useTasks } from '../shared/TasksProvider';

/** Phone (up to 1023): one column, new-note button, open group, then a collapsible done group. No tabs. */
export function TasksMobile() {
  const { lists, canWrite, openCreate } = useTasks();
  const [showDone, setShowDone] = useState(true);
  return (
    <div className="tk tk-mobile m-only">
      {canWrite ? <Pin><Button block icon="add" onClick={openCreate}>פתק חדש</Button></Pin> : <Notice>הפרויקט זמין לצפייה והדפסה בלבד.</Notice>}
      <TaskGroup headingId="tk-m-open" title="לביצוע" tasks={lists.open} empty="אין משימות לביצוע" />
      <button type="button" className="tk-toggle" aria-expanded={showDone} onClick={() => setShowDone(v => !v)}>
        {showDone ? 'הסתרת משימות שבוצעו' : `הצגת משימות שבוצעו (${lists.completed.length})`}
      </button>
      {showDone && <TaskGroup headingId="tk-m-done" title="בוצעו" tasks={lists.completed} empty="עוד אין משימות שבוצעו" />}
    </div>
  );
}
