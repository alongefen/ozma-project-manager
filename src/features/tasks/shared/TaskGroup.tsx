'use client';
import type { TaskRow } from '@/types/contracts';
import { TaskCard } from './TaskCard';

/** One group (open or done): title with count, then the cards or the empty text. */
export function TaskGroup({ title, tasks, empty, headingId }: { title: string; tasks: TaskRow[]; empty: string; headingId: string }) {
  return (
    <section className="tk-group" aria-labelledby={headingId}>
      <h2 id={headingId} className="tk-group__title">{title} <span className="tk-group__count">{tasks.length}</span></h2>
      {tasks.length === 0 ? <p className="tk-empty">{empty}</p> : <ul className="tk-list">{tasks.map(t => <TaskCard key={t.id} task={t} />)}</ul>}
    </section>
  );
}
