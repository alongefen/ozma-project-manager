import 'server-only';
import { z } from 'zod';
import type { DateRange, DiaryApi, DiaryRow, DiaryVersion, FileRef, Platform, RequestContext } from '@/types/contracts';
import type { Database } from '@/types/database';
import { DiaryApiInputSchemas, DiarySummarySchema, FileRefSchema, IsoDateSchema, IsoDateTimeSchema, UuidSchema } from '@/types/contracts/schemas';
import { failure } from '@/lib/db/rpc';
import { validated } from './validation';

type Entry = Database['public']['Tables']['diary_entries']['Row'];
type Queries = Pick<DiaryApi, 'listEntries' | 'getSummary' | 'getEntry' | 'listVersions' | 'listForReport'>;
type Filter = DateRange & { projectId?: string; cancelled?: boolean };
const cursorSchema = z.strictObject({ date: IsoDateSchema, entered: IsoDateTimeSchema, id: UuidSchema, filter: z.string() });
function filterKey(input: Filter): string {
  return JSON.stringify([input.projectId ?? null, input.from ?? null, input.to ?? null, input.cancelled ?? false]);
}

export function createDiaryQueries(platform: Platform): Queries {
  async function files(ctx: RequestContext, entryId: string, version: number): Promise<FileRef[]> {
    const { data, error } = await ctx.db.from('diary_version_files')
      .select('position,diary_attachments!inner(stored_files!inner(id,original_name,mime,size_bytes,display_state))')
      .eq('entry_id', entryId).eq('version', version).order('position', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(link => {
      const file = link.diary_attachments.stored_files;
      return FileRefSchema.parse({ id: file.id, name: file.original_name, mime: file.mime, sizeBytes: file.size_bytes, displayState: file.display_state });
    });
  }

  async function hydrate(ctx: RequestContext, entries: Entry[]): Promise<DiaryRow[]> {
    const projects = new Map<string, { name: string; report: boolean; owner: boolean }>();
    for (const entry of entries) {
      if (projects.has(entry.project_id)) continue;
      const permission = await platform.permissions.forProject(ctx, { projectId: entry.project_id });
      if (!permission.ok) throw { message: permission.error.code };
      if (!permission.value.view) throw { message: 'NOT_FOUND' };
      const { data, error } = await ctx.db.from('projects').select('name').eq('id', entry.project_id).maybeSingle();
      if (error) throw error;
      if (!data) throw { message: 'NOT_FOUND' };
      projects.set(entry.project_id, { name: data.name, report: permission.value.report, owner: permission.value.manageAccess });
    }
    return Promise.all(entries.map(async entry => {
      const project = projects.get(entry.project_id)!;
      return {
        id: entry.id, projectId: entry.project_id, projectName: project.name,
        workDate: entry.work_date, body: entry.body, reporterId: entry.reporter_id, reporterName: entry.reporter_name,
        enteredAt: entry.entered_at, editedAt: entry.edited_at, editedByName: entry.edited_by_name,
        cancelledAt: entry.cancelled_at, revision: entry.revision, files: await files(ctx, entry.id, entry.revision),
        canCorrect: !entry.cancelled_at && project.report && (project.owner || entry.reporter_id === ctx.actor.userId),
        canMoveOrCancel: !entry.cancelled_at && project.owner,
      };
    }));
  }

  const listEntries: DiaryApi['listEntries'] = validated(DiaryApiInputSchemas.listEntries, async (ctx, input) => {
    let cursor: z.infer<typeof cursorSchema> | undefined;
    if (input.cursor !== undefined) {
      if (input.cursor.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(input.cursor)) return failure('VALIDATION');
      try {
        const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')));
        if (!parsed.success || parsed.data.filter !== filterKey(input)) return failure('VALIDATION');
        cursor = parsed.data;
      } catch { return failure('VALIDATION'); }
    }
    if (input.cancelled) {
      const owner = await platform.permissions.requireOwner(ctx, {});
      if (!owner.ok) return owner;
    }
    if (input.projectId) {
      const permission = await platform.permissions.forProject(ctx, { projectId: input.projectId });
      if (!permission.ok) return permission;
      if (!permission.value.view) return failure('NOT_FOUND');
    }
    let query = ctx.db.from('diary_entries').select('*')
      .order('work_date', { ascending: false }).order('entered_at', { ascending: false }).order('id', { ascending: false }).limit(51);
    query = input.cancelled ? query.not('cancelled_at', 'is', null) : query.is('cancelled_at', null);
    if (input.projectId) query = query.eq('project_id', input.projectId);
    if (input.from) query = query.gte('work_date', input.from);
    if (input.to) query = query.lte('work_date', input.to);
    if (cursor) query = query.or(`work_date.lt.${cursor.date},and(work_date.eq.${cursor.date},entered_at.lt.${cursor.entered}),and(work_date.eq.${cursor.date},entered_at.eq.${cursor.entered},id.lt.${cursor.id})`);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data ?? [];
    const entries = rows.slice(0, 50);
    const last = entries.at(-1);
    return { ok: true, value: {
      items: await hydrate(ctx, entries),
      nextCursor: rows.length > 50 && last ? Buffer.from(JSON.stringify({ date: last.work_date, entered: last.entered_at, id: last.id, filter: filterKey(input) })).toString('base64url') : null,
    } };
  });

  const getEntry: DiaryApi['getEntry'] = validated(DiaryApiInputSchemas.getEntry, async (ctx, input) => {
    const { data, error } = await ctx.db.from('diary_entries').select('*').eq('id', input.id).maybeSingle();
    if (error) throw error;
    if (!data) return failure('NOT_FOUND');
    return { ok: true, value: (await hydrate(ctx, [data]))[0] };
  });

  return {
    listEntries,
    getEntry,
    getSummary: validated(DiaryApiInputSchemas.getSummary, async (ctx, input) => {
      if (input.projectId) {
        const permission = await platform.permissions.forProject(ctx, { projectId: input.projectId });
        if (!permission.ok) return permission;
        if (!permission.value.view) return failure('NOT_FOUND');
      }
      const result = await platform.rpc(ctx, 'diary_summary', input);
      if (!result.ok) return result;
      const parsed = DiarySummarySchema.safeParse(result.value);
      return parsed.success ? { ok: true, value: parsed.data } : failure('UNAVAILABLE');
    }),
    listVersions: validated(DiaryApiInputSchemas.listVersions, async (ctx, input) => {
      // Establish current visibility first; historical rows are independently filtered by RLS.
      const visible = await getEntry(ctx, input);
      if (!visible.ok) return visible;
      const rows = await platform.fetchAll(async (from, to) => {
        const { data, error } = await ctx.db.from('diary_versions').select('*').eq('entry_id', input.id)
          .order('version', { ascending: false }).range(from, to);
        if (error) throw error;
        return data ?? [];
      });
      const versions: DiaryVersion[] = await Promise.all(rows.map(async row => ({
        version: row.version, kind: row.kind, projectId: row.project_id, workDate: row.work_date, body: row.body,
        reporterName: row.reporter_name, editorName: row.editor_name, createdAt: row.created_at,
        files: await files(ctx, row.entry_id, row.version),
      })));
      return { ok: true, value: versions };
    }),
    listForReport: validated(DiaryApiInputSchemas.listForReport, async (ctx, { scope }) => {
      if (scope.kind === 'entry') {
        const entry = await getEntry(ctx, { id: scope.entryId });
        if (!entry.ok) return entry;
        return entry.value.cancelledAt ? failure('NOT_FOUND') : { ok: true, value: [entry.value] };
      }
      const filter = scope.kind === 'day'
        ? { projectId: scope.projectId, from: scope.date, to: scope.date }
        : { projectId: scope.projectId, from: scope.from, to: scope.to };
      const entries: DiaryRow[] = [];
      let cursor: string | undefined;
      do {
        const page = await listEntries(ctx, { ...filter, ...(cursor ? { cursor } : {}) });
        if (!page.ok) return page;
        entries.push(...page.value.items);
        cursor = page.value.nextCursor ?? undefined;
      } while (cursor);
      return { ok: true, value: entries };
    }),
  } satisfies Queries;
}
