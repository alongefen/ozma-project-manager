import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiaryRow, ErrorCode, ReportScope, Result } from '../../../src/types/contracts';
import { ReportPlanSchema } from '../../../src/types/contracts/schemas';
vi.mock('server-only', () => ({}));
import { createReportsApi, IMAGE_RESERVED_BYTES } from '../../../src/features/reports/logic/service';
import { planReport as planEngine } from '../../../src/features/reports/logic/rendering/index';
import { must, readArtifact } from './support/artifacts';
import { bytes, createWorld, denied, MiB, ok, projectA, projectB, projectName, reporterName, uuid, type World } from './support/fakes';

const date = '2026-11-18';
const day = { kind: 'day', projectId: projectA, date } as const;
const range = { kind: 'range', projectId: projectA, from: '2026-11-01', to: '2026-11-22' } as const;
const entryScope = (entryId: string) => ({ kind: 'entry', entryId }) as const;

let world: World;
let api: ReturnType<typeof createReportsApi>;
beforeEach(() => {
  world = createWorld();
  api = createReportsApi(world.platform, { diary: world.diary, render: world.render });
});

const plan = (scope: ReportScope) => api.planReport(world.ctx, { scope });
const renderPart = (scope: ReportScope, part = 1) => api.renderReportPart(world.ctx, { scope, part });
const renderedPart = (call = 0) => world.render.mock.calls[call][0];
const reads = () => world.readBytes.mock.calls.map(([, input]) => input);

function expectError(result: Result<unknown>, code: ErrorCode) {
  expect(result).toMatchObject({ ok: false, error: { code } });
  expect(result).not.toHaveProperty('value');
}
function expectNoContent() {
  expect(world.readBytes).not.toHaveBeenCalled();
  expect(world.render).not.toHaveBeenCalled();
}
function expectNothingReached() {
  for (const call of [world.forProject, world.diary.listForReport, world.diary.getSummary, world.from, world.rpc]) {
    expect(call).not.toHaveBeenCalled();
  }
  expectNoContent();
}
/** A faulty or racing DiaryApi whose counts agree with the rows it returned. */
function diaryReturns(...rows: DiaryRow[]) {
  world.diary.listForReport.mockResolvedValue(ok(rows));
  world.diary.getSummary.mockResolvedValue(ok({
    reportCount: rows.length, workDays: new Set(rows.map(row => row.workDate)).size, byProject: [],
  }));
}
function addManyEntries(count: number, withFiles = false) {
  return Array.from({ length: count }, (_, i) => world.addEntry({
    workDate: `2026-11-${String(i % 20 + 1).padStart(2, '0')}`,
    enteredAt: new Date(Date.UTC(2026, 10, 21, 0, 0, i)).toISOString(),
    files: withFiles ? [world.addFile()] : [],
  }));
}

describe('invalid or forged input reaches nothing', () => {
  const invalidScopes: [string, unknown][] = [
    ['missing', undefined],
    ['null', null],
    ['empty', {}],
    ['a string', 'day'],
    ['unknown kind', { kind: 'project', projectId: projectA }],
    ['entry without id', { kind: 'entry' }],
    ['entry with a malformed id', { kind: 'entry', entryId: "1' or '1'='1" }],
    ['entry with a chosen project', { kind: 'entry', entryId: uuid(7), projectId: projectA }],
    ['day without project', { kind: 'day', date }],
    ['day without date', { kind: 'day', projectId: projectA }],
    ['day with range keys', { ...day, from: date, to: date }],
    ['impossible date', { ...day, date: '2026-02-30' }],
    ['unpadded date', { ...day, date: '2026-11-8' }],
    ['timestamp for a date', { ...day, date: `${date}T00:00:00Z` }],
    ['malformed project', { ...day, projectId: 'project-a' }],
    ['range without end', { kind: 'range', projectId: projectA, from: date }],
    ['reversed range', { ...range, from: range.to, to: range.from }],
    ['forged project name', { ...day, projectName: 'שם מזויף' }],
    ['forged role', { ...day, role: 'manager' }],
    ['forged owner flag', { ...range, isOwner: true }],
  ];
  it.each(invalidScopes)('planReport rejects a scope: %s', async (_name, scope) => {
    expectError(await plan(scope as ReportScope), 'VALIDATION');
    expectNothingReached();
  });
  it.each(invalidScopes)('renderReportPart rejects a scope: %s', async (_name, scope) => {
    expectError(await renderPart(scope as ReportScope), 'VALIDATION');
    expectNothingReached();
  });

  it.each(['userId', 'actor', 'role', 'permissions', 'projectName', 'url', 'fileIds', 'entries', 'render'])('rejects forged field %s in both operations', async key => {
    expectError(await api.planReport(world.ctx, { scope: day, [key]: uuid(9) } as never), 'VALIDATION');
    expectError(await api.renderReportPart(world.ctx, { scope: day, part: 1, [key]: uuid(9) } as never), 'VALIDATION');
    expectNothingReached();
  });
  it.each([
    ['null', null], ['string', '1'], ['boolean', true], ['missing', undefined], ['zero', 0], ['negative', -1],
    ['fraction', 1.5], ['NaN', Number.NaN], ['infinite', Infinity], ['unsafe integer', 2 ** 53],
  ])('rejects a %s part before any read', async (_name, part) => {
    expectError(await api.renderReportPart(world.ctx, { scope: day, part } as never), 'VALIDATION');
    expectNothingReached();
  });
  it('planReport does not accept a part', async () => {
    expectError(await api.planReport(world.ctx, { scope: day, part: 1 } as never), 'VALIDATION');
    expectNothingReached();
  });
  it.each([null, undefined, 'scope', 7])('rejects input %s instead of throwing', async input => {
    expectError(await api.planReport(world.ctx, input as never), 'VALIDATION');
    expectError(await api.renderReportPart(world.ctx, input as never), 'VALIDATION');
    expectNothingReached();
  });
  it.each([2, 3, Number.MAX_SAFE_INTEGER])('rejects part %d of a one-part report without reading files', async part => {
    world.addEntry({ files: [world.addFile()] });
    expectError(await renderPart(day, part), 'VALIDATION');
    expectNoContent();
  });
});

describe('who may get a report', () => {
  it.each([['day', day], ['range', range]] as const)('an outsider gets NOT_FOUND for a %s before the diary is read', async (_name, scope) => {
    world.addEntry({ files: [world.addFile()] });
    world.state.members.clear();
    expectError(await plan(scope), 'NOT_FOUND');
    expectError(await renderPart(scope), 'NOT_FOUND');
    expect(world.diary.listForReport).not.toHaveBeenCalled();
    expect(world.diary.getSummary).not.toHaveBeenCalled();
    expect(world.from).not.toHaveBeenCalled();
    expectNoContent();
  });
  it('an outsider cannot reach a report through an entry id', async () => {
    const row = world.addEntry({ projectId: projectB, files: [world.addFile()] });
    expectError(await plan(entryScope(row.id)), 'NOT_FOUND');
    expectError(await renderPart(entryScope(row.id)), 'NOT_FOUND');
    expectNoContent();
  });
  it('an entry row is checked against its own project even if the diary returned it', async () => {
    const row = world.addEntry({ projectId: projectB, files: [world.addFile()] });
    diaryReturns(row);
    expectError(await renderPart(entryScope(row.id)), 'NOT_FOUND');
    expect(world.forProject).toHaveBeenCalledWith(world.ctx, { projectId: projectB });
    expectNoContent();
  });
  it.each(['day', 'entry'] as const)('view=false is NOT_FOUND for %s', async kind => {
    const row = world.addEntry({ files: [world.addFile()] });
    world.forProject.mockResolvedValue(ok({ view: false, report: true } as never));
    expectError(await renderPart(kind === 'day' ? day : entryScope(row.id)), 'NOT_FOUND');
    expectNoContent();
  });
  it.each(['day', 'range', 'entry'] as const)('a dead session cannot get a %s', async kind => {
    const row = world.addEntry({ files: [world.addFile()] });
    world.state.signedIn = false;
    const scope = kind === 'day' ? day : kind === 'range' ? range : entryScope(row.id);
    expectError(await plan(scope), 'UNAUTHENTICATED');
    expectError(await renderPart(scope), 'UNAUTHENTICATED');
    expectNoContent();
  });
  it('an owner flag in the context replaces no server check', async () => {
    world.addEntry({ files: [world.addFile()] });
    world.state.members.clear();
    const forged = { ...world.ctx, actor: { ...world.ctx.actor, isOwner: true } };
    expectError(await api.renderReportPart(forged, { scope: day, part: 1 }), 'NOT_FOUND');
    expectNoContent();
  });
  it.each(['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'RATE_LIMITED', 'UNAVAILABLE'] as const)('passes a %s permission error through unchanged', async code => {
    world.forProject.mockResolvedValue(denied(code));
    expect(await renderPart(day)).toEqual(denied(code));
    expect(world.diary.listForReport).not.toHaveBeenCalled();
    expectNoContent();
  });
  it('a completed project can still be planned and printed', async () => {
    const row = world.addEntry();
    world.state.completed.add(projectA);
    for (const scope of [day, range, entryScope(row.id)]) {
      expect((await plan(scope)).ok).toBe(true);
      expect((await renderPart(scope)).ok).toBe(true);
    }
  });
  it('uses the authenticated context for every read', async () => {
    world.addEntry({ files: [world.addFile()] });
    must(await renderPart(day));
    for (const call of [world.forProject, world.diary.listForReport, world.diary.getSummary, world.readBytes]) {
      expect(call).toHaveBeenCalled();
      for (const [ctx] of call.mock.calls) expect(ctx).toBe(world.ctx);
    }
  });
});

describe('access lost while a report is being produced', () => {
  const losses: [string, ErrorCode, (w: World) => void][] = [
    ['membership', 'NOT_FOUND', w => { w.state.members.delete(projectA); }],
    ['session', 'UNAUTHENTICATED', w => { w.state.signedIn = false; }],
  ];

  it.each(losses)('%s lost between plan and render', async (_name, code, lose) => {
    world.addEntry({ files: [world.addFile()] });
    must(await plan(day));
    lose(world);
    expectError(await renderPart(day), code);
    expectNoContent();
  });
  it.each(losses)('%s lost between two parts', async (_name, code, lose) => {
    addManyEntries(201, true);
    must(await renderPart(range, 1));
    world.readBytes.mockClear();
    world.render.mockClear();
    lose(world);
    expectError(await renderPart(range, 2), code);
    expectNoContent();
  });
  it.each(losses)('%s lost at a single file', async (_name, code, lose) => {
    world.addEntry({ files: [world.addFile(), world.addFile(), world.addFile()] });
    world.hooks.beforeRead = (_id, call) => { if (call === 2) lose(world); };
    expectError(await renderPart(day), code);
    expect(world.render).not.toHaveBeenCalled();
  });
  it.each(losses)('%s lost during rendering of a project report: no bytes are handed over', async (_name, code, lose) => {
    world.addEntry({ files: [world.addFile()] });
    world.hooks.duringRender = () => lose(world);
    expectError(await renderPart(day), code);
    expect(world.render).toHaveBeenCalledOnce();
  });
  it.each(losses)('%s lost during rendering of one entry: no bytes are handed over', async (_name, code, lose) => {
    const row = world.addEntry();
    world.hooks.duringRender = () => lose(world);
    expectError(await renderPart(entryScope(row.id)), code);
  });
  it('view turning false during rendering hands over nothing', async () => {
    world.addEntry();
    world.hooks.duringRender = () => { world.forProject.mockResolvedValue(ok({ view: false } as never)); };
    expectError(await renderPart(day), 'NOT_FOUND');
  });
  it('a failing permission check after rendering hands over nothing', async () => {
    world.addEntry();
    world.hooks.duringRender = () => { world.forProject.mockRejectedValue(new Error('secret check')); };
    expectError(await renderPart(day), 'UNAVAILABLE');
  });
  it('checks permission before reading and again after rendering', async () => {
    world.addEntry({ files: [world.addFile()] });
    must(await renderPart(day));
    expect(world.events[0]).toBe('forProject');
    expect(world.events.slice(-2)).toEqual(['render', 'forProject']);
    expect(world.forProject).toHaveBeenLastCalledWith(world.ctx, { projectId: projectA });
  });
});

describe('a file that may not be read', () => {
  it.each([
    ['original', 'application/pdf'], ['display', 'image/jpeg'], ['display', 'image/heic'],
  ] as const)('a blocked %s of %s fails the report and is never replaced', async (variant, mime) => {
    const file = world.addFile(mime);
    world.addEntry({ files: [file] });
    world.state.blocked.add(file.id);
    expect(await renderPart(day)).toEqual(denied('NOT_FOUND'));
    expect(reads()).toEqual([{ fileId: file.id, variant }]);
    expect(world.getSignedUrl).not.toHaveBeenCalled();
    expect(world.render).not.toHaveBeenCalled();
  });
  it('a missing display copy does not fall back to the original', async () => {
    const file = world.addFile('image/png');
    world.state.files.set(file.id, { original: bytes('full original') });
    world.addEntry({ files: [file] });
    expectError(await renderPart(day), 'NOT_FOUND');
    expect(reads()).toEqual([{ fileId: file.id, variant: 'display' }]);
  });
  it('one blocked file among readable ones means no report at all', async () => {
    const files = [world.addFile(), world.addFile('image/png'), world.addFile()];
    world.addEntry({ files });
    world.state.blocked.add(files[1].id);
    expectError(await renderPart(day), 'NOT_FOUND');
    expect(world.render).not.toHaveBeenCalled();
  });
  it.each(['UNAUTHENTICATED', 'RATE_LIMITED', 'UNAVAILABLE'] as const)('passes a %s storage error through unchanged', async code => {
    world.addEntry({ files: [world.addFile()] });
    world.readBytes.mockResolvedValue(denied(code));
    expect(await renderPart(day)).toEqual(denied(code));
    expect(world.render).not.toHaveBeenCalled();
  });
  it('starts no new reads once a file was refused', async () => {
    const files = Array.from({ length: 20 }, () => world.addFile());
    world.addEntry({ files });
    world.state.blocked.add(files[0].id);
    world.hooks.beforeRead = async id => { if (id !== files[0].id) await new Promise(resolve => setTimeout(resolve, 5)); };
    expectError(await renderPart(day), 'NOT_FOUND');
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(world.readBytes.mock.calls.length).toBeLessThanOrEqual(6);
  });
});

describe('rows that must never enter a report', () => {
  it.each([['day', day], ['range', range]] as const)('a cancelled row in a %s is a conflict', async (_name, scope) => {
    diaryReturns(world.addEntry({ cancelledAt: '2026-11-19T10:00:00Z', files: [world.addFile()] }));
    expectError(await plan(scope), 'CONFLICT');
    expectError(await renderPart(scope), 'CONFLICT');
    expectNoContent();
  });
  it.each([['day', day], ['range', range]] as const)('a row of another project in a %s is a conflict', async (_name, scope) => {
    world.state.members.add(projectB); // Being allowed in the other project does not make it part of this report.
    diaryReturns(world.addEntry(), world.addEntry({ projectId: projectB, files: [world.addFile()] }));
    expectError(await plan(scope), 'CONFLICT');
    expectError(await renderPart(scope), 'CONFLICT');
    expectNoContent();
  });
  it('a cancelled entry is NOT_FOUND even if the diary returned it', async () => {
    const row = world.addEntry({ cancelledAt: '2026-11-19T10:00:00Z', files: [world.addFile()] });
    diaryReturns(row);
    expectError(await renderPart(entryScope(row.id)), 'NOT_FOUND');
    expectNoContent();
  });
  it('a cancelled entry is absent from day and entry reports', async () => {
    const kept = world.addEntry();
    const cancelled = world.addEntry({ cancelledAt: '2026-11-19T10:00:00Z' });
    expect(must(await plan(day)).entryCount).toBe(1);
    must(await renderPart(day));
    expect(renderedPart().entries.map(entry => entry.id)).toEqual([kept.id]);
    expectError(await plan(entryScope(cancelled.id)), 'NOT_FOUND');
  });
  it.each([0, 2])('an entry scope with %d rows is NOT_FOUND', async count => {
    const rows = [world.addEntry(), world.addEntry()];
    diaryReturns(...rows.slice(0, count));
    expectError(await renderPart(entryScope(rows[0].id)), 'NOT_FOUND');
    expectNoContent();
  });
  it('a different entry than requested is never printed', async () => {
    const [wanted, other] = [world.addEntry(), world.addEntry({ files: [world.addFile()] })];
    diaryReturns(other);
    expect((await renderPart(entryScope(wanted.id))).ok).toBe(false);
    expectNoContent();
  });
  it('a row outside the dates is never printed', async () => {
    diaryReturns(world.addEntry({ workDate: '2026-11-19', files: [world.addFile()] }));
    expect((await renderPart(day)).ok).toBe(false);
    expectNoContent();
  });
  it('a duplicated row is never printed', async () => {
    const row = world.addEntry({ files: [world.addFile()] });
    diaryReturns(row, row);
    expect((await renderPart(day)).ok).toBe(false);
    expectNoContent();
  });
});

describe('an incomplete report is never returned silently', () => {
  it.each([
    ['more reports', 2, 1], ['fewer reports', 0, 1], ['more days', 1, 2], ['fewer days', 1, 0],
  ])('a summary with %s is a conflict', async (_name, reportCount, workDays) => {
    world.addEntry({ files: [world.addFile()] });
    world.diary.getSummary.mockResolvedValue(ok({ reportCount, workDays, byProject: [] }));
    expectError(await plan(day), 'CONFLICT');
    expectError(await renderPart(day), 'CONFLICT');
    expectNoContent();
  });
  it('an entry created after listing is a conflict', async () => {
    const listed = [world.addEntry()];
    world.diary.listForReport.mockImplementation(async () => {
      world.addEntry();
      return ok(listed);
    });
    expectError(await renderPart(day), 'CONFLICT');
    expectNoContent();
  });
  it.each(['listForReport', 'getSummary'] as const)('passes a %s error through unchanged', async name => {
    world.addEntry();
    world.diary[name].mockResolvedValue(denied('RATE_LIMITED'));
    expect(await plan(day)).toEqual(denied('RATE_LIMITED'));
    expect(await renderPart(day)).toEqual(denied('RATE_LIMITED'));
    expectNoContent();
  });
  it('asks for a summary of exactly the same project and dates', async () => {
    must(await plan(day));
    expect(world.diary.getSummary).toHaveBeenLastCalledWith(world.ctx, { projectId: projectA, from: date, to: date });
    must(await plan(range));
    expect(world.diary.getSummary).toHaveBeenLastCalledWith(world.ctx, { projectId: projectA, from: range.from, to: range.to });
    expect(world.diary.listForReport).toHaveBeenLastCalledWith(world.ctx, { scope: range });
  });
});

describe('planReport', () => {
  it('describes a day and reads no file', async () => {
    world.addEntry({ files: [world.addFile(), world.addFile('image/png')] });
    world.addEntry();
    world.addEntry({ workDate: '2026-11-19' });
    const value = must(await plan(day));
    expect(value).toStrictEqual({ scope: day, partCount: 1, entryCount: 2, workDays: 1 });
    expect(ReportPlanSchema.safeParse(value).success).toBe(true);
    expectNoContent();
  });
  it('includes both ends of a range and counts distinct days', async () => {
    for (const workDate of ['2026-10-31', range.from, range.from, range.to, '2026-11-23']) world.addEntry({ workDate });
    expect(must(await plan(range))).toStrictEqual({ scope: range, partCount: 1, entryCount: 3, workDays: 2 });
  });
  it('accepts a range of one date', async () => {
    world.addEntry();
    expect(must(await plan({ ...range, from: date, to: date }))).toMatchObject({ entryCount: 1, workDays: 1 });
  });
  it('describes one entry from its row, without a name query', async () => {
    const row = world.addEntry();
    world.addEntry();
    expect(must(await plan(entryScope(row.id)))).toStrictEqual({ scope: entryScope(row.id), partCount: 1, entryCount: 1, workDays: 1 });
    expect(world.from).not.toHaveBeenCalled();
  });
  it.each([['day', day], ['range', range]] as const)('an empty %s is still a report', async (_name, scope) => {
    expect(must(await plan(scope))).toStrictEqual({ scope, partCount: 1, entryCount: 0, workDays: 0 });
    expectNoContent();
  });
  it('the rendered empty report has the project name and no files', async () => {
    must(await renderPart(day));
    expect(renderedPart()).toMatchObject({ projectName, scope: { kind: 'day', date }, entries: [], number: 1, total: 1, workDays: 0 });
    expect(world.readBytes).not.toHaveBeenCalled();
  });
  it('a project without a readable name is NOT_FOUND', async () => {
    world.state.names.delete(projectA);
    expectError(await renderPart(day), 'NOT_FOUND');
    expectNoContent();
  });
  it.each([
    ['UNAUTHENTICATED', 'UNAUTHENTICATED'], ['secret database message', 'UNAVAILABLE'],
  ] as const)('maps the name query error "%s"', async (message, code) => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: { message } }) };
    world.from.mockReturnValue(query as never);
    const result = await plan(day);
    expectError(result, code);
    expect(JSON.stringify(result)).not.toContain('secret');
  });
  it.each(['day', 'range', 'entry'] as const)('an upper-case UUID, valid by the schema, works for %s', async kind => {
    const row = world.addEntry();
    const upper = {
      day: { ...day, projectId: projectA.toUpperCase() },
      range: { ...range, projectId: projectA.toUpperCase() },
      entry: entryScope(row.id.toUpperCase()),
    }[kind];
    // Guards the fixtures: both ids must contain hexadecimal letters for this to test anything.
    expect(upper).not.toEqual({ day, range, entry: entryScope(row.id) }[kind]);
    expect((await renderPart(upper)).ok).toBe(true);
  });
});

describe('what reaches the engine', () => {
  it('maps the diary row and strips projectId from the scope', async () => {
    const row = world.addEntry({ body: '  שורה\nשנייה <b> ', editedAt: '2026-11-19T09:30:00.5+00:00' });
    must(await renderPart(day));
    expect(renderedPart()).toMatchObject({ projectName, number: 1, total: 1, workDays: 1 });
    expect(renderedPart().scope).toStrictEqual({ kind: 'day', date });
    const [entry] = renderedPart().entries;
    expect(entry).toMatchObject({
      id: row.id, workDate: date, reporterName, createdAt: row.enteredAt, editedAt: row.editedAt, text: row.body,
    });
    expect(entry).not.toHaveProperty('projectId');
    expect(entry).not.toHaveProperty('reporterId');
  });
  it('uses the range and entry scopes of the engine', async () => {
    const row = world.addEntry();
    must(await renderPart(range));
    must(await renderPart(entryScope(row.id)));
    expect(renderedPart(0).scope).toStrictEqual({ kind: 'range', from: range.from, to: range.to });
    expect(renderedPart(1).scope).toStrictEqual(entryScope(row.id));
    expect(renderedPart(1).projectName).toBe(row.projectName);
  });
  it('prints oldest first', async () => {
    const late = world.addEntry({ workDate: '2026-11-19' });
    const second = world.addEntry({ enteredAt: '2026-11-18T09:00:00Z' });
    const first = world.addEntry({ enteredAt: '2026-11-18T07:00:00Z' });
    must(await renderPart(range));
    expect(renderedPart().entries.map(entry => entry.id)).toEqual([first.id, second.id, late.id]);
  });

  const variants = [
    ['application/pdf', 'none', 'original', 'application/pdf'],
    ['application/pdf', 'ready', 'original', 'application/pdf'],
    ['application/pdf', 'failed', 'original', 'application/pdf'],
    ...['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].flatMap(mime => [
      [mime, 'ready', 'display', 'image/jpeg'],
      [mime, 'failed', null, 'application/x-unconverted'],
      [mime, 'none', null, 'application/x-unconverted'],
    ] as const),
    ['text/plain', 'ready', null, 'application/x-unconverted'],
  ] as const;
  it.each(variants)('%s with displayState %s reads %s', async (mime, displayState, variant, mediaType) => {
    const file = world.addFile(mime, { displayState });
    world.addEntry({ files: [file] });
    must(await renderPart(day));
    expect(reads()).toEqual(variant ? [{ fileId: file.id, variant }] : []);
    const [attachment] = renderedPart().entries[0].attachments!;
    expect(attachment).toMatchObject({ name: file.name, mediaType });
    const expected = variant ? world.state.files.get(file.id)![variant]! : new Uint8Array();
    expect(Buffer.from(attachment.bytes).equals(Buffer.from(expected))).toBe(true);
  });
  it('keeps attachment order when reads finish out of order', async () => {
    const files = [
      world.addFile('image/png'), world.addFile(), world.addFile('image/heic', { displayState: 'failed' }),
      world.addFile('image/jpeg'), world.addFile(),
    ];
    world.addEntry({ files });
    world.hooks.beforeRead = (_id, call) => new Promise(resolve => setTimeout(resolve, 12 - call * 2));
    must(await renderPart(day));
    expect(renderedPart().entries[0].attachments!.map(item => item.name)).toEqual(files.map(file => file.name));
    expect(renderedPart().entries[0].attachments!.map(item => Buffer.from(item.bytes).toString())).toEqual([
      `display:${files[0].id}`, `original:${files[1].id}`, '', `display:${files[3].id}`, `original:${files[4].id}`,
    ]);
  });
  it('reads at most six files at a time across all entries of the part', async () => {
    for (let i = 0; i < 3; i++) world.addEntry({ files: Array.from({ length: 8 }, () => world.addFile()) });
    let active = 0;
    let highest = 0;
    world.hooks.beforeRead = async () => {
      highest = Math.max(highest, ++active);
      await new Promise(resolve => setTimeout(resolve, 2));
      active--;
    };
    must(await renderPart(day));
    expect(world.readBytes).toHaveBeenCalledTimes(24);
    expect(highest).toBeLessThanOrEqual(6);
  });
  it('takes inputBytes from the engine planner over the actual bytes', async () => {
    world.addEntry({ files: [world.addFile('image/png', { sizeBytes: 9 * MiB }), world.addFile()] });
    must(await renderPart(day));
    const part = renderedPart();
    expect(part.inputBytes).toBe(planEngine({ projectName: part.projectName, scope: part.scope, entries: part.entries })[0].inputBytes);
  });
});

describe('parts', () => {
  it('more than 200 entries: each appears once and only the files of that part are read', async () => {
    const rows = addManyEntries(401, true);
    expect(must(await plan(range))).toStrictEqual({ scope: range, partCount: 3, entryCount: 401, workDays: 20 });
    expectNoContent();
    const filesOf = new Map(rows.map(row => [row.id, row.files.map(file => file.id)]));
    const printed: string[] = [];
    for (const number of [1, 2, 3]) {
      world.readBytes.mockClear();
      must(await renderPart(range, number));
      const part = renderedPart(number - 1);
      expect(part).toMatchObject({ number, total: 3, workDays: 20 });
      expect(part.entries).toHaveLength([200, 200, 1][number - 1]);
      const ids = part.entries.map(entry => entry.id);
      expect(reads().map(read => read.fileId).sort()).toEqual(ids.flatMap(id => filesOf.get(id)!).sort());
      printed.push(...ids);
    }
    expect(printed).toEqual([...rows].sort((a, b) =>
      a.workDate.localeCompare(b.workDate) || Date.parse(a.enteredAt) - Date.parse(b.enteredAt)).map(row => row.id));
    expect(new Set(printed).size).toBe(401);
    expectError(await renderPart(range, 4), 'VALIDATION');
  });
  it('reserves 2MiB for an image, whatever the original weighs', async () => {
    expect(IMAGE_RESERVED_BYTES).toBe(2 * MiB);
    for (let i = 0; i < 4; i++) {
      world.addEntry({
        enteredAt: `2026-11-18T0${i}:00:00Z`,
        files: Array.from({ length: 10 }, () => world.addFile('image/jpeg', { sizeBytes: i % 2 ? 1 : 25 * MiB })),
      });
    }
    expect(must(await plan(day)).partCount).toBe(2);
    must(await renderPart(day, 2));
    expect(renderedPart()).toMatchObject({ number: 2, total: 2, workDays: 1 });
    expect(renderedPart().entries).toHaveLength(1);
    expect(world.readBytes).toHaveBeenCalledTimes(10);
  });
  it('twenty images, the most one entry can hold, are one part', async () => {
    world.addEntry({ files: Array.from({ length: 20 }, () => world.addFile('image/jpeg', { sizeBytes: 25 * MiB })) });
    expect(must(await plan(day)).partCount).toBe(1);
  });
  it('plans a PDF by its stored size', async () => {
    for (let i = 0; i < 3; i++) world.addEntry({ files: [world.addFile('application/pdf', { sizeBytes: 25 * MiB })] });
    expect(must(await plan(day)).partCount).toBe(2);
  });
  it('gives no weight to a file that is never read', async () => {
    world.addEntry({ files: Array.from({ length: 4 }, () => world.addFile('image/heic', { displayState: 'failed', sizeBytes: 25 * MiB })) });
    expect(must(await plan(day)).partCount).toBe(1);
  });
  it('takes a fresh snapshot for every part', async () => {
    addManyEntries(201);
    must(await renderPart(range, 1));
    world.state.names.set(projectA, 'שם מעודכן');
    must(await renderPart(range, 2));
    expect(world.diary.listForReport).toHaveBeenCalledTimes(2);
    expect(renderedPart(1).projectName).toBe('שם מעודכן');
  });
});

describe('limits', () => {
  it.each(['day', 'entry'] as const)('one entry over 75MiB is LIMIT before any read, for %s', async kind => {
    const row = world.addEntry({ files: Array.from({ length: 3 }, () => world.addFile('application/pdf', { sizeBytes: 25 * MiB })) });
    const scope = kind === 'day' ? day : entryScope(row.id);
    expectError(await plan(scope), 'LIMIT');
    expectError(await renderPart(scope), 'LIMIT');
    expectNoContent();
  });
  it('actual bytes that make one entry too large are LIMIT', async () => {
    const display = new Uint8Array(26 * MiB);
    world.addEntry({ files: Array.from({ length: 3 }, () => world.addFile('image/jpeg', { display })) });
    expectError(await renderPart(day), 'LIMIT');
    expect(world.render).not.toHaveBeenCalled();
  });
  it('actual bytes that need a second part are LIMIT, never a shorter report', async () => {
    const display = new Uint8Array(26 * MiB);
    for (let i = 0; i < 3; i++) world.addEntry({ files: [world.addFile('image/jpeg', { display })] });
    expect(must(await plan(day)).partCount).toBe(1);
    expectError(await renderPart(day), 'LIMIT');
    expect(world.render).not.toHaveBeenCalled();
  });
});

describe('unexpected failures do not leak', () => {
  const boundaries: [string, (w: World) => { mockRejectedValue(error: Error): unknown }][] = [
    ['permissions', w => w.forProject], ['diary list', w => w.diary.listForReport], ['diary summary', w => w.diary.getSummary],
    ['storage', w => w.readBytes], ['renderer', w => w.render],
  ];
  it.each(boundaries)('%s', async (_name, boundary) => {
    world.addEntry({ files: [world.addFile()] });
    boundary(world).mockRejectedValue(new Error('secret fixture /var/task/key'));
    const result = await renderPart(day);
    expectError(result, 'UNAVAILABLE');
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});

describe('the artifact', () => {
  it.each([1, 65_536, 65_537, 300_001, MiB + 3])('streams exactly %d bytes in chunks of at most 64KiB', async size => {
    const backing = Buffer.alloc(size + 20, 0xee);
    const pdf = backing.subarray(10, 10 + size);
    for (let i = 0; i < size; i++) pdf[i] = i % 251;
    world.render.mockResolvedValue({ bytes: pdf, warnings: [] });
    const artifact = must(await renderPart(day));
    expect(artifact.contentType).toBe('application/pdf');
    const read = await readArtifact(artifact);
    expect(read.bytes.equals(pdf)).toBe(true);
    expect(Math.max(...read.chunkSizes)).toBeLessThanOrEqual(65_536);
  });
  it('produces chunks only as they are pulled', async () => {
    world.render.mockResolvedValue({ bytes: new Uint8Array(2 * MiB), warnings: [] });
    const enqueue = vi.spyOn(ReadableStreamDefaultController.prototype, 'enqueue');
    try {
      const reader = must(await renderPart(day)).stream.getReader();
      await reader.read();
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(enqueue.mock.calls.length).toBeGreaterThan(0);
      expect(enqueue.mock.calls.length).toBeLessThanOrEqual(3);
      await reader.cancel();
    } finally {
      enqueue.mockRestore();
    }
  });
  it('gives identical bytes for the same report', async () => {
    world.addEntry();
    const first = await readArtifact(must(await renderPart(day)));
    const second = await readArtifact(must(await renderPart(day)));
    expect(first.bytes.equals(second.bytes)).toBe(true);
  });
  it('has a safe file name with no project, customer or reporter name', async () => {
    const hostile = 'לקוח "סודי"\r\nX-Evil: 1/../../';
    world.state.names.set(projectA, hostile);
    const row = world.addEntry({ projectName: hostile, reporterName: hostile });
    expect(must(await renderPart(day)).fileName).toBe(`work-diary-${date}.pdf`);
    expect(must(await renderPart(range)).fileName).toBe(`work-diary-${range.from}_${range.to}.pdf`);
    expect(must(await renderPart(entryScope(row.id))).fileName).toBe(`work-diary-entry-${row.id}.pdf`);
  });
  it('numbers the file only when a range has several parts', async () => {
    addManyEntries(201);
    expect(must(await renderPart(range, 2)).fileName).toBe(`work-diary-${range.from}_${range.to}-part-2-of-2.pdf`);
  });
  it('numbers a day with several parts', async () => {
    for (let i = 0; i < 201; i++) world.addEntry();
    expect(must(await renderPart(day, 1)).fileName).toBe(`work-diary-${date}-part-1-of-2.pdf`);
  });
});
