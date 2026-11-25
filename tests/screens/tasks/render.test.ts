import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TaskRow } from '@/types/contracts';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock('@/features/tasks/logic/actions', () => ({ createTask: vi.fn(), updateTask: vi.fn(), setTaskCompleted: vi.fn(), deleteTask: vi.fn() }));

import { TasksProvider } from '@/features/tasks/shared/TasksProvider';
import { TasksMobile } from '@/features/tasks/mobile/TasksMobile';
import { TasksDesktop } from '@/features/tasks/desktop/TasksDesktop';

const row = (id: string, over: Partial<TaskRow> = {}): TaskRow => ({
  id, projectId: '11111111-1111-4111-8111-111111111111', body: `פתק ${id}`, completed: false, dueDate: null, createdAt: '2026-11-23T08:00:00.000Z', revision: 1, assignees: [], ...over,
});
const initial = { open: [row('a', { dueDate: '2026-11-01' })], completed: [row('b', { completed: true })] };

function page(canWrite: boolean, canDelete: boolean) {
  return renderToStaticMarkup(
    h(TasksProvider, { projectId: 'p', initial, canWrite, canDelete, today: '2026-11-23', assignees: [{ id: 'u1', name: 'דנה בדויה', role: 'worker', isOwner: false }], userId: 'u1', initialMine: false }, h(TasksMobile), h(TasksDesktop)),
  );
}

describe('הרשאות במסך', () => {
  it('מי שרשאי לכתוב רואה יצירה, עריכה וסימון', () => {
    const html = page(true, false);
    expect(html).toContain('משימה חדשה');
    expect(html).toContain('עריכה');
    expect(html).not.toContain('מחיקה');
    expect(html).toContain('עבר היעד');
  });
  it('רק בעלים רואה מחיקה', () => {
    expect(page(true, true)).toContain('מחיקה');
  });
  it('פרויקט שהסתיים: אין יצירה, עריכה, מחיקה, והסימון נעול', () => {
    const html = page(false, false);
    expect(html).not.toContain('משימה חדשה');
    expect(html).not.toContain('משימה חדשה');
    expect(html).not.toContain('עריכה');
    expect(html).not.toContain('מחיקה');
    expect(html).toContain('לצפייה והדפסה בלבד');
    expect(html.match(/<input[^>]*type="checkbox"[^>]*>/g)!.every(t => t.includes('disabled'))).toBe(true);
  });
  it('שתי הקבוצות ומצבי ריק', () => {
    const html = renderToStaticMarkup(
      h(TasksProvider, { projectId: 'p', initial: { open: [], completed: [] }, canWrite: true, canDelete: false, today: '2026-11-23', assignees: [{ id: 'u1', name: 'דנה בדויה', role: 'worker', isOwner: false }], userId: 'u1', initialMine: false }, h(TasksMobile)),
    );
    expect(html).toContain('אין משימות לביצוע');
    // Completed tasks are hidden on entry (item 3); the toggle says how many there are.
    expect(html).not.toContain('עוד אין משימות שבוצעו');
    expect(html).toContain('הצגת משימות שבוצעו (0)');
    expect(html).toContain('aria-expanded="false"');
  });
});
