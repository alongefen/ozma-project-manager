import 'server-only';
import type { AppError, ErrorCode, RequestContext, Result } from '@/types/contracts';
import type { Database, Json } from '@/types/database';

const messages: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'יש להתחבר מחדש', FORBIDDEN: 'אין הרשאה לפעולה זו',
  NOT_FOUND: 'הפריט לא נמצא', VALIDATION: 'יש לבדוק את הפרטים שהוזנו',
  CONFLICT: 'הנתונים השתנו. יש לרענן ולנסות שוב', PROJECT_READ_ONLY: 'הפרויקט זמין לצפייה בלבד',
  LIMIT: 'הקובץ או הכמות חורגים מהמגבלה', RATE_LIMITED: 'יותר מדי ניסיונות. יש לנסות שוב מאוחר יותר',
  UNAVAILABLE: 'הפעולה לא הושלמה. יש לנסות שוב',
};
export function failure<T = never>(code: ErrorCode, fieldErrors?: Record<string, string>): Result<T> {
  return { ok: false, error: { code, message: messages[code], ...(fieldErrors ? { fieldErrors } : {}) } };
}
export function mapError(error: unknown): AppError {
  const value = error as { message?: unknown; status?: number; details?: unknown } | null;
  const message = typeof value?.message === 'string' ? value.message : '';
  const knownCode = Object.keys(messages).find(code => message === code || message.startsWith(`${code}:`)) as ErrorCode | undefined;
  const code = knownCode ?? (value?.status === 429 ? 'RATE_LIMITED' : 'UNAVAILABLE');
  const mapped: AppError = { code, message: messages[code] };
  if ((code === 'VALIDATION' || code === 'LIMIT') && typeof value?.details === 'string') {
    try {
      const detail: unknown = JSON.parse(value.details);
      if (detail && typeof detail === 'object' && 'code' in detail && detail.code === code && 'field' in detail && typeof detail.field === 'string') {
        // Only documented field identifiers are returned; provider messages and arbitrary detail strings never leave the server.
        const fields = new Set(['access', 'active', 'email', 'expectedRevision', 'requestId', 'userIds', 'workDate', 'fileIds', 'files', 'mime', 'sizeBytes']);
        if (fields.has(detail.field)) mapped.fieldErrors = { [detail.field]: messages[code] };
      }
    } catch { /* Malformed provider details keep the generic Hebrew error. */ }
  }
  return mapped;
}
export async function rpc<I, O>(ctx: RequestContext, name: string, input: I): Promise<Result<O>> {
  if (name.startsWith('system_')) return failure('FORBIDDEN');
  try {
    const { data, error } = await ctx.db.rpc(name as keyof Database['public']['Functions'], { input: input as Json });
    return error ? { ok: false, error: mapError(error) } : { ok: true, value: data as O };
  } catch { return failure('UNAVAILABLE'); }
}
export async function fetchAll<T>(page: (from: number, to: number) => Promise<T[]>): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = await page(from, from + 999);
    result.push(...rows);
    if (rows.length < 1000) return result;
  }
}
