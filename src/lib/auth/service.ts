import 'server-only';
import { z } from 'zod';
import type { Actor, AuthService, Db, RequestContext, Result } from '@/types/contracts';
import { failure, mapError } from '@/lib/db/rpc';
import { format } from '@/lib/format';
import { ActorSchema } from '@/types/contracts/schemas';

export function createAuthService({ db, authClient }: { db: Db; authClient: Db }): AuthService {
  const getContext = async (): Promise<Result<RequestContext>> => {
    try {
      const { data: identity, error: identityError } = await db.auth.getUser();
      if (identityError || !identity.user) return failure('UNAUTHENTICATED');
      const { data, error } = await db.rpc('get_actor', { input: {} });
      if (error) return { ok: false, error: mapError(error) };
      const actor = ActorSchema.safeParse(data);
      if (!actor.success || actor.data.userId !== identity.user.id) return failure('UNAUTHENTICATED');
      return { ok: true, value: { actor: actor.data, db, today: format.todayInIsrael() } };
    } catch { return failure('UNAVAILABLE'); }
  };
  return {
    getContext,
    async signIn(input): Promise<Result<Actor>> {
      const parsed = z.strictObject({ email: z.email(), password: z.string().min(1).max(1024) }).safeParse({ ...input, email: input.email?.trim().toLowerCase() });
      if (!parsed.success) return failure('VALIDATION');
      try {
        const { data, error } = await authClient.auth.signInWithPassword(parsed.data);
        if (error || !data.session) return failure(error?.status === 429 ? 'RATE_LIMITED' : 'UNAUTHENTICATED');
        const saved = await db.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
        if (saved.error) { await authClient.auth.signOut({ scope: 'local' }); return failure('UNAVAILABLE'); }
        const ctx = await getContext();
        if (!ctx.ok) { await db.auth.signOut({ scope: 'local' }); return ctx; }
        return { ok: true, value: ctx.value.actor };
      } catch { return failure('UNAVAILABLE'); }
    },
    async signOut() {
      try {
        const { error } = await db.auth.signOut({ scope: 'local' });
        return error ? { ok: false, error: mapError(error) } : { ok: true, value: null };
      } catch { return failure('UNAVAILABLE'); }
    },
  };
}
