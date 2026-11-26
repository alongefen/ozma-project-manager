import 'server-only';
import type { z } from 'zod';
import type { Operation, Platform } from '@/types/contracts';
import { failure, mapError } from '@/lib/db/rpc';
export type LeadsPlatform = Pick<Platform, 'rpc' | 'fetchAll' | 'permissions'>;
/** Recheck active owner/session on every operation, before input or data access. */
export function ownerOperation<S extends z.ZodType, O>(platform: LeadsPlatform, schema: S, operation: Operation<z.output<S>, O>): Operation<z.input<S>, O> {
  return async (ctx, input) => {
    try {
      const owner = await platform.permissions.requireOwner(ctx, {});
      if (!owner.ok) return owner;
      const parsed = schema.safeParse(input);
      if (!parsed.success) return failure('VALIDATION', Object.fromEntries(parsed.error.issues.filter(i => typeof i.path[0] === 'string').map(i => [i.path[0], 'יש לבדוק את הערך שהוזן'])));
      return await operation(ctx, parsed.data);
    } catch (error) { return { ok: false, error: mapError(error) }; }
  };
}
