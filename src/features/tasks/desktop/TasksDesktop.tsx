'use client';
import { useState } from 'react';
import { Button, Card, Notice, Pin } from '@/components/ui';
import { TaskGroup } from '../shared/TaskGroup';
import { useTasks } from '../shared/TasksProvider';

/** Desktop (from 1024): pinned bar with the new-note button, then the open group and a toggle for the done group (hidden by default). */
export function TasksDesktop() {
  const { lists, canWrite, openCreate, mine, toggleMine } = useTasks();
  const [showDone, setShowDone] = useState(false);
  return (
    <div className="tk tk-desktop d-only">
      {canWrite && <Pin className="tk-bar"><Button className="ui-lead" icon="add" onClick={openCreate}>משימה חדשה</Button></Pin>}
      {!canWrite && <Notice>הפרויקט זמין לצפייה והדפסה בלבד.</Notice>}
      <button style={{ justifySelf: "start" }} type="button" className="tk-mine" aria-pressed={mine} onClick={toggleMine}>המשימות שלי</button>
      <Card panel><TaskGroup headingId="tk-d-open" title="לביצוע" tasks={lists.open} empty="אין משימות לביצוע" /></Card>
      <button type="button" className="tk-toggle" aria-expanded={showDone} onClick={() => setShowDone(v => !v)}>
        {showDone ? 'הסתרת משימות שבוצעו' : `הצגת משימות שבוצעו (${lists.completed.length})`}
      </button>
      {showDone && <Card panel><TaskGroup headingId="tk-d-done" title="בוצעו" tasks={lists.completed} empty="עוד אין משימות שבוצעו" /></Card>}
    </div>
  );
}
