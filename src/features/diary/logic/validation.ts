import 'server-only';
import type { z } from 'zod';
import type { Operation } from '@/types/contracts';
import { failure, mapError } from '@/lib/db/rpc';

export function validated<I, O>(schema: z.ZodType<I>, operation: Operation<I, O>): Operation<I, O> {
  return async (ctx, input) => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return failure('VALIDATION');
    const value = parsed.data as I & { from?: string; to?: string; scope?: { from?: string; to?: string } };
    if ((value.from && value.to && value.from > value.to) ||
        (value.scope?.from && value.scope.to && value.scope.from > value.scope.to)) return failure('VALIDATION');
    try { return await operation(ctx, parsed.data); }
    catch (error) { return { ok: false, error: mapError(error) }; }
  };
}
