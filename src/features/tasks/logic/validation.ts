import 'server-only';
import type { z } from 'zod';
import type { Result } from '@/types/contracts';
import { failure } from '@/lib/db/rpc';

export function validate<T>(schema: z.ZodType<T>, input: unknown): Result<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string') fields[field] = 'יש לבדוק את הערך שהוזן';
  }
  return failure('VALIDATION', Object.keys(fields).length ? fields : undefined);
}
