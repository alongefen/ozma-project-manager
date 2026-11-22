import 'server-only';
import type { z } from 'zod';
import type { Operation, Platform } from '@/types/contracts';
import { failure, mapError } from '@/lib/db/rpc';

/** The live owner check also rejects revoked sessions and disabled accounts. */
export function ownerOperation<I, O>(platform: Platform, schema: z.ZodType<I>, operation: Operation<I, O>): Operation<I, O> {
  return async (ctx, input) => {
    try {
      const owner = await platform.permissions.requireOwner(ctx, {});
      if (!owner.ok) return owner;
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path[0];
          if (typeof field === 'string') fields[field] = 'יש לבדוק את הפרטים שהוזנו';
        }
        return failure('VALIDATION', fields);
      }
      return await operation(ctx, parsed.data);
    } catch (error) { return { ok: false, error: mapError(error) }; }
  };
}
