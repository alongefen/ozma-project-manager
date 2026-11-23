import 'server-only';
import type { HomeData, Platform, RequestContext, TransferMonth } from '@/types/contracts';
import { createProjectsApi } from '@/features/projects/logic';
import { createDiaryApi } from '@/features/diary/logic';
import { createFinanceApi } from '@/features/finance/logic';
import { createOverviewApi } from '../logic';

const api = (platform: Platform) =>
  createOverviewApi(platform, { projects: createProjectsApi(platform), diary: createDiaryApi(platform), finance: createFinanceApi(platform) });

export type HomeLoad = { kind: 'ok'; data: HomeData } | { kind: 'signed-out' } | { kind: 'error' };
export async function loadHome(platform: Platform, ctx: RequestContext): Promise<HomeLoad> {
  const result = await api(platform).getHome(ctx, {});
  if (result.ok) return { kind: 'ok', data: result.value };
  return result.error.code === 'UNAUTHENTICATED' ? { kind: 'signed-out' } : { kind: 'error' };
}

/** `hidden` for everyone but the owner (P29): the database refuses, and nothing is read for them. */
export type TransferLoad = { kind: 'ok'; months: TransferMonth[] } | { kind: 'hidden' } | { kind: 'signed-out' } | { kind: 'error' };
export async function loadTransfer(platform: Platform, ctx: RequestContext): Promise<TransferLoad> {
  if (!ctx.actor.isOwner) return { kind: 'hidden' };
  const result = await api(platform).getTransferSummary(ctx, {});
  if (result.ok) return { kind: 'ok', months: result.value };
  const code = result.error.code;
  if (code === 'UNAUTHENTICATED') return { kind: 'signed-out' };
  return code === 'FORBIDDEN' || code === 'NOT_FOUND' ? { kind: 'hidden' } : { kind: 'error' };
}
