import 'server-only';
import type { z } from 'zod';
import type { DiaryApi, Platform, Saved, RequestContext } from '@/types/contracts';
import { DiaryApiInputSchemas, SavedSchema } from '@/types/contracts/schemas';
import { failure } from '@/lib/db/rpc';
import { validated } from './validation';

type Commands = Pick<DiaryApi, 'createEntry' | 'correctEntry' | 'moveEntry' | 'cancelEntry'>;
export function createDiaryCommands(platform: Platform): Commands {
  function command<K extends keyof Commands>(key: K, rpc: string): Commands[K] {
    return validated(DiaryApiInputSchemas[key] as z.ZodType<unknown>, async (ctx: RequestContext, input: unknown) => {
      // RPC owns live authorization, server timestamps, idempotency and revisions.
      const result = await platform.rpc<typeof input, Saved>(ctx, rpc, input);
      if (!result.ok) return result;
      const saved = SavedSchema.safeParse(result.value);
      return saved.success ? { ok: true, value: saved.data } : failure('UNAVAILABLE');
    }) as Commands[K];
  }
  return {
    createEntry: command('createEntry', 'create_entry'),
    correctEntry: command('correctEntry', 'correct_entry'),
    moveEntry: command('moveEntry', 'move_entry'),
    cancelEntry: command('cancelEntry', 'cancel_entry'),
  } satisfies Commands;
}
