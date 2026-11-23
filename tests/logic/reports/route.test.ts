import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const boundary = vi.hoisted(() => ({ createPlatform: vi.fn(), createDiaryApi: vi.fn(), render: vi.fn() }));
vi.mock('../../../src/lib/auth/platform', () => ({ createPlatform: boundary.createPlatform }));
vi.mock('../../../src/features/diary/logic/service', () => ({ createDiaryApi: boundary.createDiaryApi }));
vi.mock('../../../src/features/reports/logic/rendering/render', () => ({ renderReportPart: boundary.render, renderHtmlToPdf: vi.fn() }));
import * as route from '../../../src/app/api/reports/diary/route';
import { createWorld, denied, MiB, projectA, projectB, uuid, type World } from './support/fakes';

const date = '2026-11-18';
const day = `kind=day&projectId=${projectA}&date=${date}`;
const range = `kind=range&projectId=${projectA}&from=2026-11-01&to=2026-11-22`;
const get = (query: string, headers: Record<string, string> = {}) =>
  route.GET(new Request(`https://app.invalid/api/reports/diary?${query}`, { headers }));

let world: World;
beforeEach(() => {
  vi.resetAllMocks();
  world = createWorld();
  boundary.createPlatform.mockResolvedValue(world.platform);
  boundary.createDiaryApi.mockReturnValue(world.diary);
  boundary.render.mockImplementation(world.render);
});

async function expectJsonError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('content-disposition')).toBeNull();
  const body = await response.text();
  expect(JSON.parse(body)).toMatchObject({ ok: false, error: { code } });
  expect(body).not.toMatch(/%PDF|secret/);
}
function expectNothingReached() {
  for (const call of [world.forProject, world.diary.listForReport, world.diary.getSummary, world.from, world.readBytes, world.render]) {
    expect(call).not.toHaveBeenCalled();
  }
}

describe('GET /api/reports/diary: configuration', () => {
  it('runs dynamically on Node with room to render, and has GET only', () => {
    expect(route).toMatchObject({ runtime: 'nodejs', dynamic: 'force-dynamic', maxDuration: 300 });
    expect(Object.keys(route).sort()).toEqual(['GET', 'dynamic', 'maxDuration', 'runtime']);
  });
});

describe('GET /api/reports/diary: authentication first', () => {
  it.each([day, 'kind=nonsense', '', `${day}&userId=${uuid(1)}`])('no session is 401 before parsing "%s"', async query => {
    world.state.signedIn = false;
    await expectJsonError(await get(query), 401, 'UNAUTHENTICATED');
    expect(boundary.createDiaryApi).not.toHaveBeenCalled();
    expectNothingReached();
  });
  it('passes another context error through', async () => {
    world.getContext.mockResolvedValue(denied('RATE_LIMITED'));
    await expectJsonError(await get(day), 429, 'RATE_LIMITED');
    expectNothingReached();
  });
  it('takes identity only from the server context', async () => {
    world.addEntry({ files: [world.addFile()] });
    const response = await get(day, { 'x-user-id': uuid(99), 'x-role': 'owner', authorization: 'Bearer forged' });
    expect(response.status).toBe(200);
    expect(boundary.createDiaryApi).toHaveBeenCalledWith(world.platform);
    expect(world.readBytes.mock.calls[0][0]).toBe(world.ctx);
  });
});

describe('GET /api/reports/diary: strict query', () => {
  const entryId = uuid(0x99);
  it.each([
    ['empty', ''],
    ['missing kind', `projectId=${projectA}&date=${date}`],
    ['empty kind', 'kind='],
    ['unknown kind', `kind=project&projectId=${projectA}`],
    ['inherited kind', 'kind=constructor'],
    ['prototype kind', 'kind=__proto__'],
    ['upper-case kind', day.replace('day', 'DAY')],
    ['entry without id', 'kind=entry'],
    ['entry with empty id', 'kind=entry&entryId='],
    ['entry with project', `kind=entry&entryId=${entryId}&projectId=${projectA}`],
    ['entry with date', `kind=entry&entryId=${entryId}&date=${date}`],
    ['malformed entry id', 'kind=entry&entryId=../secret'],
    ['day without project', `kind=day&date=${date}`],
    ['day without date', `kind=day&projectId=${projectA}`],
    ['day with entry', `${day}&entryId=${entryId}`],
    ['day with range key', `${day}&from=${date}`],
    ['day with empty range key', `${day}&to=`],
    ['impossible date', day.replace(date, '2026-02-30')],
    ['malformed project', day.replace(projectA, 'abc')],
    ['range without start', `kind=range&projectId=${projectA}&to=${date}`],
    ['range without end', `kind=range&projectId=${projectA}&from=${date}`],
    ['range with date', `${range}&date=${date}`],
    ['reversed range', `kind=range&projectId=${projectA}&from=2026-11-22&to=2026-11-01`],
    ['repeated kind', `${day}&kind=day`],
    ['second kind', `${day}&kind=range`],
    ['repeated project', `${day}&projectId=${projectA}`],
    ['second project', `${day}&projectId=${projectB}`],
    ['repeated date', `${day}&date=${date}`],
    ['repeated part', `${day}&part=1&part=1`],
    ['repeated download', `${day}&download=0&download=1`],
    ['key with another case', `${day}&Part=1`],
    ['bracket key', `${day}&projectId[]=${projectA}`],
    ['empty key', `${day}&=1`],
  ])('%s is 400 and reaches nothing', async (_name, query) => {
    await expectJsonError(await get(query), 400, 'VALIDATION');
    expectNothingReached();
  });

  it.each([
    'userId', 'actorId', 'role', 'isOwner', 'ctx', 'scope', 'url', 'fileId', 'variant', 'projectName', 'fileName',
    'executablePath', 'render', 'cache', '__proto__', 'constructor', 'toString', 'hasOwnProperty',
  ])('cannot supply %s', async key => {
    await expectJsonError(await get(`${day}&${key}=forged`), 400, 'VALIDATION');
    expectNothingReached();
  });

  it.each([
    '', '0', '-1', '%2B1', '+1', '01', '1.0', '1.5', '1e1', '0x1', '%201', '1%20', '1%0A', 'NaN', 'Infinity',
    '9007199254740992', '%D9%A1', '1,2',
  ])('part=%s is not a part', async part => {
    await expectJsonError(await get(`${day}&part=${part}`), 400, 'VALIDATION');
    expectNothingReached();
  });

  it.each(['', '2', 'true', 'false', '01', '%201', 'attachment'])('download=%s is invalid', async download => {
    await expectJsonError(await get(`${day}&download=${download}`), 400, 'VALIDATION');
    expectNothingReached();
  });

  it.each(['2', '9007199254740991'])('part=%s of a one-part report is 400 without file reads', async part => {
    world.addEntry({ files: [world.addFile()] });
    await expectJsonError(await get(`${day}&part=${part}`), 400, 'VALIDATION');
    expect(world.readBytes).not.toHaveBeenCalled();
    expect(world.render).not.toHaveBeenCalled();
  });
});

describe('GET /api/reports/diary: success', () => {
  it.each([
    ['', 'inline'], ['&download=0', 'inline'], ['&download=1', 'attachment'], ['&part=1&download=1', 'attachment'],
  ])('"%s" is served %s with private PDF headers', async (extra, disposition) => {
    world.addEntry();
    const response = await get(day + extra);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe(`${disposition}; filename="work-diary-${date}.pdf"`);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-length')).toBeNull();
    expect(await response.text()).toMatch(/^%PDF-fake/);
  });
  it('inline and download hand over identical bytes', async () => {
    world.addEntry({ files: [world.addFile('image/png')] });
    const shown = Buffer.from(await (await get(day)).arrayBuffer());
    const saved = Buffer.from(await (await get(`${day}&download=1`)).arrayBuffer());
    expect(saved.equals(shown)).toBe(true);
    expect(world.render.mock.calls[1][0]).toEqual(world.render.mock.calls[0][0]);
  });
  it('streams a file over the 4.5MB response limit exactly', async () => {
    const pdf = Buffer.alloc(6 * MiB, 0x5a);
    boundary.render.mockResolvedValue({ bytes: pdf, warnings: [] });
    const response = await get(day);
    expect(response.headers.get('content-length')).toBeNull();
    expect(Buffer.from(await response.arrayBuffer()).equals(pdf)).toBe(true);
  });
  it('serves one entry', async () => {
    const row = world.addEntry();
    const response = await get(`kind=entry&entryId=${row.id}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe(`inline; filename="work-diary-entry-${row.id}.pdf"`);
  });
  it('serves the requested part of a range', async () => {
    for (let i = 0; i < 201; i++) world.addEntry();
    const response = await get(`${range}&part=2&download=1`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="work-diary-2026-11-01_2026-11-22-part-2-of-2.pdf"');
    expect(world.render.mock.calls[0][0]).toMatchObject({ number: 2, total: 2 });
  });
  it('serves an empty day of a completed project', async () => {
    world.state.completed.add(projectA);
    expect((await get(day)).status).toBe(200);
  });
});

describe('GET /api/reports/diary: refusals', () => {
  it('a non-member gets 404', async () => {
    world.state.members.clear();
    await expectJsonError(await get(day), 404, 'NOT_FOUND');
    expect(world.diary.listForReport).not.toHaveBeenCalled();
  });
  it('another project entry id gets 404', async () => {
    const row = world.addEntry({ projectId: projectB });
    await expectJsonError(await get(`kind=entry&entryId=${row.id}`), 404, 'NOT_FOUND');
  });
  it('membership lost during rendering gets 404 and no PDF', async () => {
    world.addEntry();
    world.hooks.duringRender = () => { world.state.members.clear(); };
    await expectJsonError(await get(`${day}&download=1`), 404, 'NOT_FOUND');
  });
  it('session lost during rendering gets 401 and no PDF', async () => {
    world.addEntry();
    world.hooks.duringRender = () => { world.state.signedIn = false; };
    await expectJsonError(await get(day), 401, 'UNAUTHENTICATED');
  });
  it('a blocked file gets 404', async () => {
    const file = world.addFile();
    world.addEntry({ files: [file] });
    world.state.blocked.add(file.id);
    await expectJsonError(await get(day), 404, 'NOT_FOUND');
  });
  it('incomplete counts are 409', async () => {
    world.diary.getSummary.mockResolvedValue({ ok: true, value: { reportCount: 1, workDays: 1, byProject: [] } });
    await expectJsonError(await get(day), 409, 'CONFLICT');
  });
  it('an oversized entry is 413', async () => {
    world.addEntry({ files: Array.from({ length: 3 }, () => world.addFile('application/pdf', { sizeBytes: 25 * MiB })) });
    await expectJsonError(await get(day), 413, 'LIMIT');
  });
  it.each(['createPlatform', 'createDiaryApi', 'render'] as const)('a thrown %s is 503 without its message', async name => {
    boundary[name].mockImplementation(() => { throw new Error('secret fixture'); });
    await expectJsonError(await get(day), 503, 'UNAVAILABLE');
  });
  it('a thrown getContext is 503 without its message', async () => {
    world.getContext.mockRejectedValue(new Error('secret fixture'));
    await expectJsonError(await get(day), 503, 'UNAVAILABLE');
  });
});
