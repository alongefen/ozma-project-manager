import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Platform, RequestContext } from '@/types/contracts';
import type { DiaryScreen } from '@/features/diary/shared/types';

const mocks = vi.hoisted(() => ({ listEntries: vi.fn(), getSummary: vi.fn(), loadProject: vi.fn(), listProjects: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/features/diary/logic', () => ({ createDiaryApi: () => mocks }));
vi.mock('@/features/projects/logic', () => ({ createProjectsApi: () => mocks }));
vi.mock('@/features/projects/shared/load', () => ({ loadProject: mocks.loadProject }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock('@/features/diary/logic/actions', () => ({ getEntry: vi.fn(), getSummary: vi.fn(), listEntries: vi.fn(), cancelEntry: vi.fn() }));
vi.mock('@/features/reports/logic/actions', () => ({ planReport: vi.fn() }));
import { loadDiaryScreen } from '@/features/diary/shared/load';
import { DiaryProvider } from '@/features/diary/shared/DiaryProvider';
import { DiaryMobile } from '@/features/diary/mobile/DiaryMobile';
import { DiaryDesktop } from '@/features/diary/desktop/DiaryDesktop';

const P = '11111111-1111-4111-8111-111111111111';
const platform = {} as Platform;
const ctx = { actor: { isOwner: true }, today: '2026-11-26' } as RequestContext;
const ok = <T,>(value: T) => ({ ok: true as const, value });
const failed = (code = 'UNAVAILABLE') => ({ ok: false as const, error: { code, message: 'Unavailable' } });
const summary = (workDays: number) => ok({ workDays, reportCount: 80, byProject: [] });
const load = (projectId: string | undefined = P, filter = {}) => loadDiaryScreen(platform, ctx, { projectId, filter, basePath: projectId ? `/projects/${projectId}/diary` : '/diary' });
const markup = (screen: DiaryScreen, desktop: boolean) => renderToStaticMarkup(h(DiaryProvider, { screen, children: h(desktop ? DiaryDesktop : DiaryMobile, { screen }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listEntries.mockResolvedValue(ok({ items: [], nextCursor: 'more-pages' }));
  mocks.getSummary.mockResolvedValue(summary(12));
  mocks.listProjects.mockResolvedValue(ok([]));
  mocks.loadProject.mockResolvedValue({ project: { id: P, name: 'פרויקט לדוגמה', status: 'active', archivedAt: null, permissions: { report: true } } });
});

describe('project work days: server loader and both layouts', () => {
  it('uses the fixed project and exact date range, independently of loaded pages', async () => {
    const r = await load(P, { projectId: 'ignored', from: '2026-11-01', to: '2026-11-20' });
    expect(mocks.getSummary).toHaveBeenCalledWith(ctx, { projectId: P, from: '2026-11-01', to: '2026-11-20' });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.screen.rows).toHaveLength(0);
    expect(r.screen.nextCursor).toBe('more-pages');
    for (const desktop of [false, true]) expect(markup(r.screen, desktop)).toContain('ימי עבודה שדווחו: 12');
  });
  it('no range requests all project dates; real zero is displayed', async () => {
    mocks.getSummary.mockResolvedValue(summary(0));
    const r = await load();
    expect(mocks.getSummary).toHaveBeenCalledWith(ctx, { projectId: P });
    if (r.kind !== 'ok') throw new Error(r.kind);
    for (const desktop of [false, true]) expect(markup(r.screen, desktop)).toContain('ימי עבודה שדווחו: 0');
  });
  it('general diary, even with a project filter, makes no aggregate request or counter', async () => {
    const r = await loadDiaryScreen(platform, ctx, { filter: { projectId: P }, basePath: '/diary' });
    expect(mocks.getSummary).not.toHaveBeenCalled();
    if (r.kind !== 'ok') throw new Error(r.kind);
    for (const desktop of [false, true]) expect(markup(r.screen, desktop)).not.toContain('ימי עבודה שדווחו');
  });
  it.each(['result', 'exception'])('summary %s failure keeps the diary and shows unavailable, never zero', async mode => {
    if (mode === 'result') mocks.getSummary.mockResolvedValue(failed());
    else mocks.getSummary.mockRejectedValue(new Error('network'));
    const r = await load();
    if (r.kind !== 'ok') throw new Error(r.kind);
    for (const desktop of [false, true]) {
      const html = markup(r.screen, desktop);
      expect(html).toContain('מספר ימי העבודה אינו זמין כרגע');
      expect(html).not.toContain('ימי עבודה שדווחו: 0');
    }
  });
  it.each(['FORBIDDEN', 'NOT_FOUND', 'UNAUTHENTICATED'])('never exposes a count when summary refuses %s', async code => {
    mocks.getSummary.mockResolvedValue(failed(code));
    expect((await load()).kind).toBe(code === 'UNAUTHENTICATED' ? 'signed-out' : 'hidden');
  });
  it('a forbidden list never exposes a successful summary', async () => {
    mocks.listEntries.mockResolvedValue(failed('FORBIDDEN'));
    expect(await load()).toEqual({ kind: 'hidden' });
  });
});
