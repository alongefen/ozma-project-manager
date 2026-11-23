import 'server-only';
import type { DocumentCategory, DocumentRow, FilesApi, Platform, RequestContext } from '@/types/contracts';
import { failure, mapError } from '@/lib/db/rpc';
import { AccessCandidateSchema } from '@/types/contracts/schemas';

const categories: DocumentCategory[] = ['specification', 'plans', 'additional_plans', 'renderings'];
const columns = 'id,project_id,category,uploaded_by_name,created_at,archived_at,revision,access,stored_files!inner(id,original_name,mime,size_bytes,display_state)' as const;
function documents(ctx: RequestContext) { return ctx.db.from('documents').select(columns); }
type Row = NonNullable<Awaited<ReturnType<typeof documents>>['data']>[number];
function document(row: Row, owner: boolean, userIds: string[]): DocumentRow {
  if (!row.stored_files.mime || row.stored_files.size_bytes === null) throw new Error('UNAVAILABLE');
  return {
    id: row.id, projectId: row.project_id, category: row.category,
    uploadedByName: row.uploaded_by_name, createdAt: row.created_at,
    archived: row.archived_at !== null, revision: row.revision,
    file: { id: row.stored_files.id, name: row.stored_files.original_name, mime: row.stored_files.mime, sizeBytes: row.stored_files.size_bytes, displayState: row.stored_files.display_state },
    ...(owner ? { access: row.access === 'selected' ? { mode: 'selected' as const, userIds: userIds } : { mode: row.access } } : {}),
  };
}
// Escape LIKE metacharacters so searching for a literal filename cannot broaden the query.
function pattern(search: string) { return `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`; }
export function createQueries(platform: Platform) {
  async function owner(ctx: RequestContext) {
    const result = await platform.permissions.requireOwner(ctx, {});
    if (!result.ok && result.error.code !== 'FORBIDDEN') return result;
    return { ok: true as const, value: result.ok };
  }
  async function mapDocument(ctx: RequestContext, row: Row, isOwner: boolean): Promise<DocumentRow> {
    const userIds = isOwner && row.access === 'selected' ? await platform.fetchAll(async (from, to) => {
      const result = await ctx.db.from('document_grants').select('user_id').eq('document_id', row.id).order('user_id').range(from, to);
      if (result.error) throw result.error;
      return (result.data ?? []).map(grant => grant.user_id);
    }) : [];
    return document(row, isOwner, userIds);
  }
  return {
    async listAccessCandidates(ctx, input) {
      const result = await platform.rpc< typeof input, unknown>(ctx, 'project_access_candidates', input);
      if (!result.ok) return result;
      const parsed = AccessCandidateSchema.array().safeParse(result.value);
      return parsed.success ? { ok: true, value: parsed.data.map(({userId, fullName}) => ({ userId, fullName })) } : failure('UNAVAILABLE');
    },
    async listDocuments(ctx, input) {
      try {
        const permission = await platform.permissions.forProject(ctx, { projectId: input.projectId });
        if (!permission.ok) return permission;
        if (!permission.value.view) return failure('NOT_FOUND');
        const ownership = await owner(ctx); if (!ownership.ok) return ownership;
        const filter = <T extends { eq: (column: string, value: never) => T; is: (column: string, value: null) => T; not: (column: string, operator: string, value: null) => T; ilike: (column: string, value: string) => T }>(query: T): T => {
          query = query.eq('project_id', input.projectId as never);
          query = input.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
          if (input.search?.trim()) query = query.ilike('stored_files.original_name', pattern(input.search));
          return query;
        };
        const items = await platform.fetchAll(async (from, to) => {
          let query = filter(documents(ctx));
          if (input.category) query = query.eq('category', input.category);
          const result = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to);
          if (result.error) throw result.error;
          return Promise.all((result.data ?? []).map(row => mapDocument(ctx, row, ownership.value)));
        });
        const countByCategory = { specification: 0, plans: 0, additional_plans: 0, renderings: 0 };
        for (const category of categories) {
          const result = await filter(ctx.db.from('documents').select('id,stored_files!inner(original_name)', { count: 'exact', head: true })).eq('category', category);
          if (result.error) return { ok: false, error: mapError(result.error) };
          if (result.count === null) return failure('UNAVAILABLE');
          countByCategory[category] = result.count;
        }
        return { ok: true, value: { items, countByCategory } };
      } catch (error) { return { ok: false, error: mapError(error) }; }
    },
    async getDocument(ctx, input) {
      try {
        const ownership = await owner(ctx); if (!ownership.ok) return ownership;
        const result = await documents(ctx).eq('id', input.id).maybeSingle();
        if (result.error) return { ok: false, error: mapError(result.error) };
        return result.data ? { ok: true, value: await mapDocument(ctx, result.data, ownership.value) } : failure('NOT_FOUND');
      } catch (error) { return { ok: false, error: mapError(error) }; }
    },
  } satisfies Pick<FilesApi, 'listAccessCandidates' | 'listDocuments' | 'getDocument'>;
}
