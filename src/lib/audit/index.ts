import 'server-only';
import type { AuditService } from '@/types/contracts';
import { AuditServiceInputSchemas } from '@/types/contracts/schemas';
import { permissions } from '@/lib/permissions';
import { failure, mapError } from '@/lib/db/rpc';
export const audit: AuditService = {
  async list(ctx, input) {
    const owner = await permissions.requireOwner(ctx, {}); if (!owner.ok) return owner;
    const parsed = AuditServiceInputSchemas.list.safeParse(input);
    if (!parsed.success || (input.cursor !== undefined && (!/^[1-9]\d*$/.test(input.cursor) || !Number.isSafeInteger(Number(input.cursor))))) return failure('VALIDATION');
    try {
      let query = ctx.db.from('sensitive_events').select('*').order('id', { ascending: false }).limit(51);
      if (input.projectId) query = query.eq('project_id', input.projectId);
      if (input.cursor) query = query.lt('id', Number(input.cursor));
      const { data, error } = await query;
      if (error) return { ok: false, error: mapError(error) };
      const rows = data ?? [];
      const items = rows.slice(0, 50).map(row => ({ id: row.id, occurredAt: row.occurred_at, actorName: row.actor_label, action: row.action, entityType: row.entity_type, entityId: row.entity_id, projectId: row.project_id, before: row.before, after: row.after }));
      return { ok: true, value: { items, nextCursor: rows.length > 50 ? String(items.at(-1)!.id) : null } };
    } catch { return failure('UNAVAILABLE'); }
  },
};
