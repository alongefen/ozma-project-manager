import 'server-only';
import type { BinaryArtifact, DiaryApi, Platform, ReportPlan, ReportScope, ReportsApi, Result } from '@/types/contracts';
import { ReportsApiInputSchemas as inputs } from '@/types/contracts/schemas';
import { createDiaryApi } from '@/features/diary/logic/service';
import { failure } from '@/lib/db/rpc';
import { fileName, planFile, toEngineScope, toManifestEntry } from './adapter';
import { loadSnapshot, readFiles, requireView, type FileRead, type Snapshot } from './queries';
import { planReport, planReportManifest, renderReportPart, ReportLimitError, type ReportManifestPart, type ReportPart } from './rendering';

export { IMAGE_RESERVED_BYTES } from './adapter';
const CHUNK = 64 * 1024;

type Options = { diary?: Pick<DiaryApi, 'listForReport' | 'getSummary'>; render?: typeof renderReportPart };

/** The database compares ids case-insensitively and returns lower case; everything downstream uses lower case. */
function parseScope(value: unknown, withPart: boolean): { scope: ReportScope; part?: number } | null {
  const parsed = (withPart ? inputs.renderReportPart : inputs.planReport).safeParse(value);
  if (!parsed.success) return null;
  const scope = parsed.data.scope as ReportScope;
  if (scope.kind === 'range' && scope.from > scope.to) return null;
  const lowered: ReportScope = scope.kind === 'entry' ? { kind: 'entry', entryId: scope.entryId.toLowerCase() }
    : scope.kind === 'day' ? { kind: 'day', projectId: scope.projectId.toLowerCase(), date: scope.date }
    : { kind: 'range', projectId: scope.projectId.toLowerCase(), from: scope.from, to: scope.to };
  const number = (parsed.data as { part?: number }).part;
  if (number !== undefined && (!Number.isSafeInteger(number) || number < 1)) return null;
  return { scope: lowered, part: number };
}

function plan(snapshot: Snapshot): ReportManifestPart[] {
  return planReportManifest({ projectName: snapshot.projectName, scope: toEngineScope(snapshot.scope), entries: snapshot.rows.map(toManifestEntry) });
}

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) { controller.close(); return; }
      controller.enqueue(bytes.subarray(offset, Math.min(offset + CHUNK, bytes.byteLength)));
      offset += CHUNK;
      if (offset >= bytes.byteLength) controller.close();
    },
  });
}

export function createReportsApi(platform: Platform, options: Options = {}): ReportsApi {
  const diary = options.diary ?? createDiaryApi(platform);
  const render = options.render ?? renderReportPart;

  const guarded = async <T>(run: () => Promise<Result<T>>): Promise<Result<T>> => {
    try { return await run(); }
    catch (error) { return error instanceof ReportLimitError ? failure('LIMIT') : failure('UNAVAILABLE'); }
  };

  return {
    planReport: (ctx, input) => guarded(async () => {
      const parsed = parseScope(input, false);
      if (!parsed) return failure('VALIDATION');
      const snapshot = await loadSnapshot(platform, diary, ctx, parsed.scope);
      if (!snapshot.ok) return snapshot;
      const parts = plan(snapshot.value);
      const value: ReportPlan = { scope: parsed.scope, partCount: parts.length, entryCount: snapshot.value.rows.length, workDays: parts[0].workDays };
      return { ok: true, value };
    }),

    renderReportPart: (ctx, input) => guarded(async () => {
      const parsed = parseScope(input, true);
      if (!parsed || parsed.part === undefined) return failure('VALIDATION');
      const snapshot = await loadSnapshot(platform, diary, ctx, parsed.scope);
      if (!snapshot.ok) return snapshot;
      const parts = plan(snapshot.value);
      if (parsed.part > parts.length) return failure('VALIDATION');
      const planned = parts[parsed.part - 1];
      const byId = new Map(snapshot.value.rows.map(row => [row.id, row]));

      // Only the files of this part are read; unreadable kinds are passed on as empty, marked "unconverted".
      const reads: FileRead[] = [];
      planned.entries.forEach((entry, entryIndex) => byId.get(entry.id)!.files.forEach((file, attachment) => {
        const { variant } = planFile(file);
        if (variant) reads.push({ entry: entryIndex, attachment, file, variant });
      }));
      const contents = await readFiles(platform, ctx, reads);
      if (!contents.ok) return contents;
      const bytesOf = new Map(reads.map((read, i) => [`${read.entry}:${read.attachment}`, contents.value[i]]));
      const entries = planned.entries.map((entry, entryIndex) => ({
        ...entry,
        attachments: (entry.attachments ?? []).map((attachment, index) => ({
          name: attachment.name, mediaType: attachment.mediaType, bytes: bytesOf.get(`${entryIndex}:${index}`) ?? new Uint8Array(),
        })),
      }));
      // Planned again from the real bytes: a report never silently shrinks into a different part.
      const actual = planReport({ projectName: planned.projectName, scope: planned.scope, entries });
      if (actual.length !== 1) return failure('LIMIT');
      const part: ReportPart = { ...actual[0], number: planned.number, total: planned.total, workDays: planned.workDays };
      const rendered = await render(part);
      // Access may have ended while the report was produced; no bytes are handed over then.
      const stillAllowed = await requireView(platform, ctx, snapshot.value.projectId);
      if (!stillAllowed.ok) return stillAllowed;
      const artifact: BinaryArtifact = {
        fileName: fileName(parsed.scope, planned.number, planned.total), contentType: 'application/pdf', stream: streamOf(rendered.bytes),
      };
      return { ok: true, value: artifact };
    }),
  };
}
