import 'server-only';
import type { z } from 'zod';
import type { Operation } from '@/types/contracts';
import { failure } from '@/lib/db/rpc';

export function validated<I, O>(schema: z.ZodType<I>, operation: Operation<I, O>): Operation<I, O> {
  return async (ctx, input) => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fields[issue.path.map(String).join('.') || 'input'] = 'יש לבדוק את הערך שהוזן';
      }
      return failure('VALIDATION', fields);
    }
    try { return await operation(ctx, parsed.data); }
    catch { return failure('UNAVAILABLE'); }
  };
}
