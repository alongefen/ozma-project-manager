import type { ReportEntry, ReportInput, ReportManifestEntry, ReportManifestInput, ReportManifestPart, ReportPart, ReportScope } from "./types";

export const MAX_REPORTS_PER_PART = 200;
export const MAX_INPUT_BYTES = 75 * 1024 * 1024;

/** A size limit was exceeded, as opposed to invalid input. */
export class ReportLimitError extends Error {
  constructor(message: string) { super(message); this.name = "ReportLimitError"; }
}

interface Sizable { name: string; mediaType: string }
type AnyEntry<A extends Sizable> = Omit<ReportEntry, "attachments"> & { attachments?: A[] };

function string(value: unknown, field: string, allowEmpty = false): asserts value is string {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    throw new Error(`שדה לא תקין: ${field}`);
  }
}

function date(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error("תאריך עבודה לא תקין");
  }
}

function timestamp(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error("מועד הזנה או עריכה לא תקין; נדרש אזור זמן מפורש");
  }
  date(value.slice(0, 10));
}

function validateScope(scope: ReportScope): void {
  if (!scope || typeof scope !== "object") throw new Error("היקף דוח חסר");
  switch (scope.kind) {
    case "entry": string(scope.entryId, "entryId"); break;
    case "day": date(scope.date); break;
    case "range":
      date(scope.from); date(scope.to);
      if (scope.from > scope.to) throw new Error("טווח התאריכים הפוך");
      break;
    default: throw new Error("היקף דוח לא תקין");
  }
}

function validateEntry<A extends Sizable>(entry: AnyEntry<A>, scope: ReportScope, checkBytes: (attachment: A) => void): void {
  if (!entry || typeof entry !== "object") throw new Error("דיווח לא תקין");
  string(entry.id, "id"); string(entry.reporterName, "reporterName");
  string(entry.text, "text", true); date(entry.workDate); timestamp(entry.createdAt);
  if (entry.editedAt != null) {
    timestamp(entry.editedAt);
    if (Date.parse(entry.editedAt) < Date.parse(entry.createdAt)) throw new Error("מועד העריכה קודם למועד ההזנה");
  }
  if ((scope.kind === "entry" && entry.id !== scope.entryId) ||
    (scope.kind === "day" && entry.workDate !== scope.date) ||
    (scope.kind === "range" && (entry.workDate < scope.from || entry.workDate > scope.to))) {
    throw new Error(`דיווח מחוץ להיקף הדוח: ${entry.id}`);
  }
  if (entry.attachments !== undefined && !Array.isArray(entry.attachments)) throw new Error("רשימת צירופים לא תקינה");
  for (const attachment of entry.attachments ?? []) {
    if (!attachment || typeof attachment !== "object") throw new Error("צירוף לא תקין");
    string(attachment.name, "attachment.name"); string(attachment.mediaType, "attachment.mediaType");
    checkBytes(attachment);
  }
}

function entryBytes<A extends Sizable>(entry: AnyEntry<A>, byteLength: (attachment: A) => number): number {
  const { attachments, ...fields } = entry;
  return Buffer.byteLength(JSON.stringify(fields), "utf8") + (attachments ?? []).reduce(
    (sum, attachment) => sum + byteLength(attachment) + Buffer.byteLength(JSON.stringify({ name: attachment.name, mediaType: attachment.mediaType }), "utf8"), 0);
}

interface PlanSource<E> { projectName: string; scope: ReportScope; entries: E[] }
interface PlanPart<E> extends PlanSource<E> { number: number; total: number; inputBytes: number; workDays: number }

function planCore<A extends Sizable, E extends AnyEntry<A>>(
  input: PlanSource<E>, byteLength: (attachment: A) => number, checkBytes: (attachment: A) => void,
): PlanPart<E>[] {
  if (!input || typeof input !== "object") throw new Error("קלט דוח חסר");
  string(input.projectName, "projectName"); validateScope(input.scope);
  if (!Array.isArray(input.entries)) throw new Error("רשימת דיווחים לא תקינה");
  const ids = new Set<string>();
  for (const entry of input.entries) {
    validateEntry(entry, input.scope, checkBytes);
    if (ids.has(entry.id)) throw new Error(`דיווח כפול: ${entry.id}`);
    ids.add(entry.id);
  }
  const entries = [...input.entries].sort((a, b) => a.workDate.localeCompare(b.workDate) ||
    Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
  const baseBytes = Buffer.byteLength(JSON.stringify({ projectName: input.projectName, scope: input.scope }), "utf8");
  if (baseBytes > MAX_INPUT_BYTES) throw new ReportLimitError("כותרת הדוח חורגת ממגבלת 75MiB");
  const workDays = new Set(entries.map(entry => entry.workDate)).size;
  const parts: PlanPart<E>[] = [];
  const newPart = (): PlanPart<E> => ({ projectName: input.projectName, scope: { ...input.scope }, entries: [], number: parts.length + 1, total: 0, inputBytes: baseBytes, workDays });
  let current = newPart();
  for (const entry of entries) {
    const bytes = entryBytes(entry, byteLength);
    if (baseBytes + bytes > MAX_INPUT_BYTES) throw new ReportLimitError(`דיווח ${entry.id} חורג לבדו ממגבלת 75MiB; לא הופק דוח חלקי`);
    if (current.entries.length === MAX_REPORTS_PER_PART || current.inputBytes + bytes > MAX_INPUT_BYTES) {
      parts.push(current); current = newPart();
    }
    current.entries.push(entry); current.inputBytes += bytes;
  }
  parts.push(current);
  for (const part of parts) part.total = parts.length;
  return parts;
}

/** Input limits count UTF-8 metadata/text and original attachment bytes, before base64 encoding. */
export function planReport(input: ReportInput): ReportPart[] {
  return planCore<ReportEntry["attachments"] extends (infer A)[] | undefined ? A : never, ReportEntry>(
    input, attachment => attachment.bytes.byteLength,
    attachment => { if (!(attachment.bytes instanceof Uint8Array)) throw new Error("נדרשים בייטים מוכנים לצירוף"); });
}

/** The same partition as planReport, from declared sizes only, so no file has to be read to plan. */
export function planReportManifest(input: ReportManifestInput): ReportManifestPart[] {
  return planCore<NonNullable<ReportManifestEntry["attachments"]>[number], ReportManifestEntry>(
    input, attachment => attachment.byteLength,
    attachment => {
      if (!Number.isSafeInteger(attachment.byteLength) || attachment.byteLength < 0) throw new Error("גודל צירוף לא תקין");
    });
}

export function validatePart(part: ReportPart): void {
  const planned = planReport(part);
  if (planned.length !== 1 || !Number.isSafeInteger(part.number) || !Number.isSafeInteger(part.total) ||
    part.number < 1 || part.total < part.number || !Number.isSafeInteger(part.workDays) ||
    part.workDays < planned[0].workDays || part.inputBytes !== planned[0].inputBytes ||
    part.entries.some((entry, index) => entry.id !== planned[0].entries[index]?.id)) {
    throw new Error("חלק דוח לא תקין; יש ליצור אותו באמצעות planReport");
  }
}
