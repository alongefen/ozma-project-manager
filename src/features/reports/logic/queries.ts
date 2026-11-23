import 'server-only';
import type { DiaryApi, FileRef, Platform, ProjectPermissions, ReportScope, RequestContext, Result, Uuid } from '@/types/contracts';
import { failure, mapError } from '@/lib/db/rpc';

export type Snapshot = { scope: ReportScope; projectId: Uuid; projectName: string; rows: Awaited<ReturnType<DiaryApi['listForReport']>> extends Result<infer R> ? R : never };

const fail = <T>(result: Result<unknown>): Result<T> => result as Result<T>;

/** A project the actor may view right now; the error is returned exactly as the permission service gave it. */
export async function requireView(platform: Platform, ctx: RequestContext, projectId: Uuid): Promise<Result<ProjectPermissions>> {
  const permissions = await platform.permissions.forProject(ctx, { projectId });
  if (!permissions.ok) return permissions;
  return permissions.value.view ? permissions : failure('NOT_FOUND');
}

async function projectName(ctx: RequestContext, projectId: Uuid): Promise<Result<string>> {
  // Read with the caller's own session, so row-level security decides whether the project exists for them.
  const { data, error } = await ctx.db.from('projects').select('name').eq('id', projectId).maybeSingle();
  if (error) return { ok: false, error: mapError(error) };
  const name = (data as { name?: unknown } | null)?.name;
  return typeof name === 'string' && name.trim() ? { ok: true, value: name } : failure('NOT_FOUND');
}

/** A live, complete and consistent list of the reports in scope, or an error. Nothing is cached between calls. */
export async function loadSnapshot(platform: Platform, diary: Pick<DiaryApi, 'listForReport' | 'getSummary'>, ctx: RequestContext, scope: ReportScope): Promise<Result<Snapshot>> {
  if (scope.kind === 'entry') {
    const listed = await diary.listForReport(ctx, { scope });
    if (!listed.ok) return fail(listed);
    const [row] = listed.value;
    if (listed.value.length !== 1 || row.id !== scope.entryId || row.cancelledAt) return failure('NOT_FOUND');
    const allowed = await requireView(platform, ctx, row.projectId);
    if (!allowed.ok) return fail(allowed);
    return { ok: true, value: { scope, projectId: row.projectId, projectName: row.projectName, rows: listed.value } };
  }
  const allowed = await requireView(platform, ctx, scope.projectId);
  if (!allowed.ok) return fail(allowed);
  const name = await projectName(ctx, scope.projectId);
  if (!name.ok) return fail(name);
  const from = scope.kind === 'day' ? scope.date : scope.from;
  const to = scope.kind === 'day' ? scope.date : scope.to;
  const listed = await diary.listForReport(ctx, { scope });
  if (!listed.ok) return fail(listed);
  const summary = await diary.getSummary(ctx, { projectId: scope.projectId, from, to });
  if (!summary.ok) return fail(summary);
  const ids = new Set(listed.value.map(row => row.id));
  const days = new Set(listed.value.map(row => row.workDate));
  const consistent = ids.size === listed.value.length && listed.value.every(row =>
    !row.cancelledAt && row.projectId === scope.projectId && row.workDate >= from && row.workDate <= to) &&
    summary.value.reportCount === listed.value.length && summary.value.workDays === days.size;
  if (!consistent) return failure('CONFLICT');
  return { ok: true, value: { scope, projectId: scope.projectId, projectName: name.value, rows: listed.value } };
}

export type FileRead = { entry: number; attachment: number; file: FileRef; variant: 'original' | 'display' };

/** Reads every requested file, at most six at a time, stopping at the first refusal. All or nothing. */
export async function readFiles(platform: Platform, ctx: RequestContext, reads: FileRead[]): Promise<Result<Uint8Array[]>> {
  const out: Uint8Array[] = new Array(reads.length);
  let next = 0;
  let refused: Result<never> | null = null;
  const worker = async () => {
    while (!refused && next < reads.length) {
      const index = next++;
      const read = reads[index];
      const result = await platform.storage.readBytes(ctx, { fileId: read.file.id, variant: read.variant });
      if (!result.ok) { refused ??= result as Result<never>; return; }
      out[index] = result.value;
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, reads.length) }, worker));
  return refused ?? { ok: true, value: out };
}
