import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const boundary = vi.hoisted(() => ({ createPlatform: vi.fn(), createDiaryApi: vi.fn(), render: vi.fn() }));
vi.mock('../../../src/lib/auth/platform', () => ({ createPlatform: boundary.createPlatform }));
vi.mock('../../../src/features/diary/logic/service', () => ({ createDiaryApi: boundary.createDiaryApi }));
vi.mock('../../../src/features/reports/logic/rendering/render', () => ({ renderReportPart: boundary.render, renderHtmlToPdf: vi.fn() }));
import * as actions from '../../../src/features/reports/logic/actions';
import { createWorld, denied, projectA, uuid, type World } from './support/fakes';

const input = { scope: { kind: 'day', projectId: projectA, date: '2026-11-18' } } as const;
let world: World;
beforeEach(() => {
  vi.resetAllMocks();
  world = createWorld();
  boundary.createPlatform.mockResolvedValue(world.platform);
  boundary.createDiaryApi.mockReturnValue(world.diary);
});

describe('Report server actions', () => {
  it('exposes planning only; bytes leave through the route', () => {
    expect(Object.keys(actions)).toEqual(['planReport']);
  });
  it('plans with the server context, without files or rendering', async () => {
    world.addEntry({ files: [world.addFile()] });
    expect(await actions.planReport(input)).toEqual({ ok: true, value: { ...input, partCount: 1, entryCount: 1, workDays: 1 } });
    expect(world.diary.listForReport.mock.calls[0][0]).toBe(world.ctx);
    expect(world.readBytes).not.toHaveBeenCalled();
    expect(boundary.render).not.toHaveBeenCalled();
  });
  it('ignores a context passed by the caller', async () => {
    const forged = { actor: { userId: uuid(99), isOwner: true } };
    const call = actions.planReport as (...args: unknown[]) => Promise<unknown>;
    expect(await call(input, forged)).toMatchObject({ ok: true });
    expect(world.forProject.mock.calls[0][0]).toBe(world.ctx);
  });
  it('does nothing without a session', async () => {
    world.getContext.mockResolvedValue(denied('UNAUTHENTICATED'));
    expect(await actions.planReport(input)).toEqual(denied('UNAUTHENTICATED'));
    expect(boundary.createDiaryApi).not.toHaveBeenCalled();
    expect(world.forProject).not.toHaveBeenCalled();
  });
  it('refuses a non-member', async () => {
    world.state.members.clear();
    expect(await actions.planReport(input)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
  it.each(['userId', 'ctx', 'role', 'part'])('rejects forged %s', async key => {
    expect(await actions.planReport({ ...input, [key]: uuid(99) } as never)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(world.forProject).not.toHaveBeenCalled();
  });
  it('does not disclose provider exceptions', async () => {
    boundary.createPlatform.mockRejectedValue(new Error('secret fixture'));
    const result = await actions.planReport(input);
    expect(result).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
