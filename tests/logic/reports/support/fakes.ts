import { vi } from 'vitest';
import type {
  DiaryApi, DiaryRow, ErrorCode, FileRef, Platform, ProjectPermissions, RequestContext, Result, StorageService,
} from '../../../../src/types/contracts';
import type { renderReportPart } from '../../../../src/features/reports/logic/rendering/index';

export const uuid = (n: number) => `10000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
export const projectA = uuid(0xa);
export const projectB = uuid(0xb);
export const projectName = 'פרויקט בדוי';
export const reporterName = 'מדווח בדוי';
export const MiB = 1024 * 1024;

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const denied = <T = never>(code: ErrorCode): Result<T> => ({ ok: false, error: { code, message: 'נדחה' } });
export const bytes = (text: string) => new TextEncoder().encode(text);

/**
 * A small in-memory server at the Platform/DiaryApi boundary. Like the real one it denies by the
 * current session, the current membership and the current project of an entry, on every call.
 * Tests revoke access through `state`, or at an exact moment through `hooks`.
 */
export function createWorld() {
  const state = {
    signedIn: true,
    members: new Set([projectA]),
    names: new Map([[projectA, projectName], [projectB, 'פרויקט אחר']]),
    completed: new Set<string>(),
    rows: [] as DiaryRow[],
    files: new Map<string, Partial<Record<'original' | 'display', Uint8Array>>>(),
    blocked: new Set<string>(),
  };
  const hooks: {
    beforeRead?: (fileId: string, call: number) => void | Promise<void>;
    duringRender?: () => void | Promise<void>;
  } = {};
  const events: string[] = [];
  let sequence = 0xa00; // hexadecimal letters in every generated id

  // The database compares UUIDs case-insensitively and returns them in lower case.
  const access = (id: string): Result<null> => {
    if (!state.signedIn) return denied('UNAUTHENTICATED');
    return state.members.has(id.toLowerCase()) ? ok(null) : denied('NOT_FOUND');
  };
  const visible = (id: string, from = '0000-01-01', to = '9999-12-31') => state.rows.filter(row =>
    row.projectId === id.toLowerCase() && !row.cancelledAt && row.workDate >= from && row.workDate <= to);

  const forProject = vi.fn<Platform['permissions']['forProject']>(async (_ctx, input) => {
    events.push('forProject');
    const allowed = access(input.projectId);
    if (!allowed.ok) return allowed;
    const writable = !state.completed.has(input.projectId.toLowerCase());
    const value: ProjectPermissions = {
      view: true, editDetails: false, uploadDocument: false, manageAccess: false, writeTasks: writable,
      deleteTasks: false, report: writable, viewFinance: false, writeFinance: false, cancelTransaction: false,
    };
    return ok(value);
  });

  const diary = {
    listForReport: vi.fn<DiaryApi['listForReport']>(async (_ctx, { scope }) => {
      events.push('listForReport');
      if (scope.kind === 'entry') {
        const row = state.rows.find(item => item.id === scope.entryId.toLowerCase());
        if (!state.signedIn) return denied('UNAUTHENTICATED');
        return row && !row.cancelledAt && access(row.projectId).ok ? ok([row]) : denied('NOT_FOUND');
      }
      const allowed = access(scope.projectId);
      if (!allowed.ok) return allowed;
      const found = scope.kind === 'day' ? visible(scope.projectId, scope.date, scope.date) : visible(scope.projectId, scope.from, scope.to);
      // DiaryApi lists newest first; the report prints oldest first.
      return ok([...found].sort((a, b) => b.workDate.localeCompare(a.workDate) || b.enteredAt.localeCompare(a.enteredAt) || b.id.localeCompare(a.id)));
    }),
    getSummary: vi.fn<DiaryApi['getSummary']>(async (_ctx, input) => {
      events.push('getSummary');
      const id = input.projectId!;
      const allowed = access(id);
      if (!allowed.ok) return allowed;
      const found = visible(id, input.from, input.to);
      return ok({ reportCount: found.length, workDays: new Set(found.map(row => row.workDate)).size, byProject: [] });
    }),
  };

  const readBytes = vi.fn<StorageService['readBytes']>(async (_ctx, { fileId, variant }) => {
    events.push('readBytes');
    await hooks.beforeRead?.(fileId, readBytes.mock.calls.length);
    if (!state.signedIn) return denied('UNAUTHENTICATED');
    const row = state.rows.find(item => !item.cancelledAt && item.files.some(file => file.id === fileId));
    const content = state.files.get(fileId)?.[variant];
    if (!row || !access(row.projectId).ok || state.blocked.has(fileId) || !content) return denied('NOT_FOUND');
    return ok(content);
  });

  const render = vi.fn<typeof renderReportPart>(async part => {
    events.push('render');
    await hooks.duringRender?.();
    // Deterministic, and different for each part, so responses can be compared byte for byte.
    return { bytes: bytes(`%PDF-fake ${part.number}/${part.total} ${part.entries.map(entry => entry.id).join()}`), warnings: [] };
  });

  const from = vi.fn((table: string) => {
    events.push('db');
    if (table !== 'projects') throw new Error(`unexpected table ${table}`);
    let id = '';
    const query = {
      select: (columns: string) => {
        if (columns !== 'name') throw new Error(`unexpected columns ${columns}`);
        return query;
      },
      eq: (column: string, value: string) => {
        if (column !== 'id') throw new Error(`unexpected filter ${column}`);
        id = value.toLowerCase();
        return query;
      },
      maybeSingle: async () => ({ data: access(id).ok && state.names.has(id) ? { name: state.names.get(id)! } : null, error: null }),
    };
    return query;
  });

  const ctx = {
    actor: { userId: uuid(1), fullName: 'בודק בדוי', email: 'test@example.invalid', isOwner: false },
    today: '2026-11-22', db: { from },
  } as unknown as RequestContext;
  const getContext = vi.fn<Platform['auth']['getContext']>(async () => state.signedIn ? ok(ctx) : denied('UNAUTHENTICATED'));
  const getSignedUrl = vi.fn<StorageService['getSignedUrl']>();
  const rpc = vi.fn();
  const platform = { auth: { getContext }, permissions: { forProject }, storage: { readBytes, getSignedUrl }, rpc } as unknown as Platform;

  function addFile(mime = 'application/pdf', options: {
    displayState?: FileRef['displayState']; sizeBytes?: number; original?: Uint8Array; display?: Uint8Array; name?: string;
  } = {}): FileRef {
    const id = uuid(sequence++);
    const original = options.original ?? bytes(`original:${id}`);
    const display = options.display ?? bytes(`display:${id}`);
    // Both variants always exist here, so a forbidden fallback would succeed and be noticed.
    state.files.set(id, { original, display });
    return {
      id, mime, name: options.name ?? `קובץ ${id}`, sizeBytes: options.sizeBytes ?? original.byteLength,
      displayState: options.displayState ?? (mime.startsWith('image/') ? 'ready' : 'none'),
    };
  }
  function addEntry(values: Partial<DiaryRow> = {}): DiaryRow {
    const row: DiaryRow = {
      id: uuid(sequence++), projectId: projectA, projectName, workDate: '2026-11-18', body: 'דיווח בדוי',
      reporterId: uuid(1), reporterName, enteredAt: '2026-11-18T08:00:00.123456+00:00', editedAt: null,
      editedByName: null, cancelledAt: null, revision: 1, files: [], canCorrect: false, canMoveOrCancel: false, ...values,
    };
    state.rows.push(row);
    return row;
  }

  return { state, hooks, events, ctx, platform, diary, render, forProject, readBytes, getContext, getSignedUrl, rpc, from, addFile, addEntry };
}
export type World = ReturnType<typeof createWorld>;
