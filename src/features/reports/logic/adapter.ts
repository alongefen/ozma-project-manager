import 'server-only';
import type { DiaryRow, FileRef, ReportScope } from '@/types/contracts';
import type { ReportManifestEntry, ReportScope as EngineScope } from './rendering';

/** A display copy of an image is reserved at 2MiB for planning, whatever the original weighs. */
export const IMAGE_RESERVED_BYTES = 2 * 1024 * 1024;
export const UNCONVERTED = 'application/x-unconverted';
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

/** What to read for a file, if anything. Only the original of a PDF and the display copy of an image are readable. */
export type FilePlan = { variant: 'original' | 'display' | null; mediaType: string; plannedBytes: number };

export function planFile(file: FileRef): FilePlan {
  if (file.mime === 'application/pdf') return { variant: 'original', mediaType: 'application/pdf', plannedBytes: file.sizeBytes };
  if (IMAGE_MIMES.has(file.mime) && file.displayState === 'ready') {
    return { variant: 'display', mediaType: 'image/jpeg', plannedBytes: IMAGE_RESERVED_BYTES };
  }
  return { variant: null, mediaType: UNCONVERTED, plannedBytes: 0 };
}

export function toEngineScope(scope: ReportScope): EngineScope {
  if (scope.kind === 'day') return { kind: 'day', date: scope.date };
  if (scope.kind === 'range') return { kind: 'range', from: scope.from, to: scope.to };
  return { kind: 'entry', entryId: scope.entryId };
}

export function toManifestEntry(row: DiaryRow): ReportManifestEntry {
  return {
    id: row.id, workDate: row.workDate, reporterName: row.reporterName, createdAt: row.enteredAt, editedAt: row.editedAt, text: row.body,
    attachments: row.files.map(file => {
      const plan = planFile(file);
      return { name: file.name, mediaType: plan.mediaType, byteLength: plan.plannedBytes };
    }),
  };
}

export function fileName(scope: ReportScope, part: number, total: number): string {
  const base = scope.kind === 'entry' ? `entry-${scope.entryId}` : scope.kind === 'day' ? scope.date : `${scope.from}_${scope.to}`;
  return `work-diary-${base}${total > 1 ? `-part-${part}-of-${total}` : ''}.pdf`;
}
