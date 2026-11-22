import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { clients, owner, project, value, type TestActor } from './support/cloud';

let ben: TestActor;
beforeAll(async () => {
  ben = await owner(clients().admin);
});

describe('מזהה הישות בלוג נפרד ממזהה המבצע', () => {
  it('רושם את מזהה הפרויקט שנוצר', async () => {
    const created = await project(ben.client, 'לוג פרויקט');
    const { data, error } = await ben.client.from('sensitive_events')
      .select('action,entity_type,entity_id,actor_id,project_id')
      .eq('project_id', created.id).eq('action', 'project.created').single();
    expect(error).toBeNull();
    expect(data).toEqual({
      action: 'project.created', entity_type: 'project', entity_id: created.id,
      actor_id: ben.id, project_id: created.id,
    });
    expect(data?.entity_id).not.toBe(ben.id);
  });

  it('רושם את מזהה התנועה ואת הפרויקט והמבצע בנפרד', async () => {
    const created = await project(ben.client, 'לוג תנועה');
    const transaction = await value<{ id: string; revision: number }>(ben.client, 'create_transaction', {
      requestId: randomUUID(), projectId: created.id,
      fields: { year: 2026, month: 1, day: null, kind: 'income', amount: 1700, details: 'תנועה בדויה לבדיקת לוג' },
    });
    const { data, error } = await ben.client.from('sensitive_events')
      .select('action,entity_type,entity_id,actor_id,project_id,before,after')
      .eq('project_id', created.id).eq('action', 'transaction.created').single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      action: 'transaction.created', entity_type: 'transaction', entity_id: transaction.id,
      actor_id: ben.id, project_id: created.id, before: null,
      after: { id: transaction.id, amount: 1700, project_id: created.id },
    });
    expect(data?.entity_id).not.toBe(ben.id);
    expect(data?.entity_id).not.toBe(created.id);
  });
});
