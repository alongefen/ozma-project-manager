import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { createPlatform } from '@/lib/auth/platform';
import { SIGN_IN_PATH } from '@/lib/navigation';
import type { Platform, RequestContext } from '@/types/contracts';
import { createProjectsApi } from '../logic';

/** Signed-in context for a project page: signed out goes to sign-in, any other failure to a generic not-available state. */
export async function pageContext(): Promise<{ platform: Platform; ctx: RequestContext }> {
  const platform = await createPlatform();
  const context = await platform.auth.getContext();
  if (!context.ok) {
    if (context.error.code === 'UNAUTHENTICATED') redirect(SIGN_IN_PATH);
    throw new Error('context unavailable');
  }
  return { platform, ctx: context.value };
}

/** The project the viewer may see, or 404 without saying whether it exists (DESIGN 5). */
export async function loadProject(id: string) {
  const { platform, ctx } = await pageContext();
  const result = await createProjectsApi(platform).getProject(ctx, { id });
  if (!result.ok) {
    if (result.error.code === 'UNAUTHENTICATED') redirect(SIGN_IN_PATH);
    if (result.error.code === 'NOT_FOUND' || result.error.code === 'FORBIDDEN' || result.error.code === 'VALIDATION') notFound();
    throw new Error('project unavailable');
  }
  return { platform, ctx, project: result.value };
}
