/** Local rendering input only. Authorization and fetching belong to the later integration. */
export type ReportScope =
  | { kind: "entry"; entryId: string }
  | { kind: "day"; date: string }
  | { kind: "range"; from: string; to: string };

export interface ReportAttachment {
  name: string;
  mediaType: string;
  bytes: Uint8Array;
}

export interface ReportEntry {
  id: string;
  workDate: string;
  reporterName: string;
  createdAt: string;
  editedAt?: string | null;
  text: string;
  attachments?: ReportAttachment[];
}

export interface ReportInput {
  projectName: string;
  scope: ReportScope;
  entries: ReportEntry[];
}

export interface ReportPart extends ReportInput {
  number: number;
  total: number;
  inputBytes: number;
  /** Distinct work dates across the complete selected range, not just this part. */
  workDays: number;
}

export interface ReportWarning {
  entryId: string;
  attachmentName: string;
  message: string;
}

export interface RenderOptions {
  /** Optional locally installed Chromium for development; production uses the packaged Linux binary. */
  executablePath?: string;
}

/** An attachment known only by its declared size; used to plan parts before any file is read. */
export interface ReportManifestAttachment { name: string; mediaType: string; byteLength: number }
export interface ReportManifestEntry extends Omit<ReportEntry, "attachments"> { attachments?: ReportManifestAttachment[] }
export interface ReportManifestInput { projectName: string; scope: ReportScope; entries: ReportManifestEntry[] }
export interface ReportManifestPart extends ReportManifestInput { number: number; total: number; inputBytes: number; workDays: number }
