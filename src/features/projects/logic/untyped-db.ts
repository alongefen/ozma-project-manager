import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestContext } from '@/types/contracts';

/**
 * Reads of tables that are newer than the generated `src/types/database.ts` (project notes and extra contacts).
 * Remove this cast when the types are regenerated after the migration is applied.
 */
export function untypedDb(ctx: RequestContext): SupabaseClient {
  return ctx.db as unknown as SupabaseClient;
}
