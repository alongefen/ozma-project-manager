import { describe, expect, it } from 'vitest';
import type { TaskRow } from '@/types/contracts';
import { MAX_BODY, dueInfo, onlyMine, parseDraft, withRevision, withToggled, withoutTask } from '@/features/tasks/shared/model';

const row = (id: string, over: Partial<TaskRow> = {}): TaskRow => ({
  id, projectId: '11111111-1111-4111-8111-111111111111', body: 'בדוי', completed: false, dueDate: null, createdAt: '2026-11-23T08:00:00.000Z', revision: 1, assigneeId: null, assigneeName: null, ...over,
});

describe('מעבר בין קבוצות', () => {
  it('סימון מעביר לראש בוצעו וביטול מחזיר ללביצוע', () => {
    const lists = { open: [row('a'), row('b')], completed: [row('c', { completed: true })] };
    const done = withToggled(lists, 'a', true);
    expect(done.open.map(t => t.id)).toEqual(['b']);
    expect(done.completed.map(t => t.id)).toEqual(['a', 'c']);
    expect(done.completed[0].completed).toBe(true);
    const back = withToggled(done, 'c', false);
    expect(back.open.map(t => t.id)).toEqual(['c', 'b']);
  });
  it('מזהה לא קיים לא משנה דבר', () => {
    const lists = { open: [row('a')], completed: [] };
    expect(withToggled(lists, 'zzz', true)).toBe(lists);
  });
  it('הסרה מכל קבוצה', () => {
    const lists = { open: [row('a')], completed: [row('c', { completed: true })] };
    expect(withoutTask(lists, 'c').completed).toEqual([]);
  });
});

describe('גרסה אחרי שמירה', () => {
  it('מעדכן רק את הפתק שנשמר', () => {
    const lists = { open: [row('a'), row('b')], completed: [] };
    const next = withRevision(lists, 'a', 5);
    expect(next.open.map(t => t.revision)).toEqual([5, 1]);
  });
  it('ביטול סימון של פתק אחד אינו נוגע באחר', () => {
    const moved = withToggled(withToggled({ open: [row('a'), row('b')], completed: [] }, 'a', true), 'b', true);
    const undone = withToggled(moved, 'a', false);
    expect(undone.open.map(t => t.id)).toEqual(['a']);
    expect(undone.completed.map(t => t.id)).toEqual(['b']);
  });
});

describe('תאריך יעד', () => {
  it('בלי יעד: אין תצוגה', () => expect(dueInfo(null, '2026-11-23', false)).toBeNull());
  it('יעד שעבר בפתק פתוח מוצג במילים', () => {
    expect(dueInfo('2026-11-20', '2026-11-23', false)).toEqual({ text: 'עבר היעד · 20.11.2026', overdue: true });
  });
  it('יעד היום ועתידי אינם באיחור, ופתק שבוצע אינו מסומן', () => {
    expect(dueInfo('2026-11-23', '2026-11-23', false)?.overdue).toBe(false);
    expect(dueInfo('2026-11-20', '2026-11-23', true)).toEqual({ text: 'יעד 20.11.2026', overdue: false });
  });
});

describe('טופס פתק', () => {
  it('רווחים בלבד נדחים ליד השדה', () => {
    expect(parseDraft({ body: '   ', dueDate: '', assigneeId: '' })).toEqual({ ok: false, errors: { body: 'יש לכתוב את תוכן המשימה' } });
  });
  it('מעל 2,000 תווים נדחה, בדיוק 2,000 עובר', () => {
    expect(parseDraft({ body: 'א'.repeat(MAX_BODY + 1), dueDate: '', assigneeId: '' }).ok).toBe(false);
    expect(parseDraft({ body: 'א'.repeat(MAX_BODY), dueDate: '', assigneeId: '' }).ok).toBe(true);
  });
  it('גוזם, ויעד ריק הופך ל-null', () => {
    expect(parseDraft({ body: ' לקנות ברגים ', dueDate: '', assigneeId: '' })).toEqual({ ok: true, body: 'לקנות ברגים', dueDate: null, assigneeId: null });
    expect(parseDraft({ body: 'א', dueDate: '2026-12-01', assigneeId: '' })).toEqual({ ok: true, body: 'א', dueDate: '2026-12-01', assigneeId: null });
  });
  it('תאריך לא תקין נדחה', () => {
    expect(parseDraft({ body: 'א', dueDate: '1.12.26', assigneeId: '' }).ok).toBe(false);
  });
});

describe('אחראי (A-46)', () => {
  it('אחראי ריק הופך ל-null וערך נשמר', () => {
    expect(parseDraft({ body: 'א', dueDate: '', assigneeId: 'u1' })).toMatchObject({ ok: true, assigneeId: 'u1' });
    expect(parseDraft({ body: 'א', dueDate: '', assigneeId: '' })).toMatchObject({ ok: true, assigneeId: null });
  });
  it('המשימות שלי מסנן לפי האחראי', () => {
    const list = [row('a', { assigneeId: 'u1' }), row('b', { assigneeId: 'u2' }), row('c')];
    expect(onlyMine(list, 'u1').map(t => t.id)).toEqual(['a']);
  });
});
