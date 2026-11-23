import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Db, Platform, ReportScope, RequestContext, Result, Saved } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { createDiaryApi } from '../../../src/features/diary/logic/service';
import { createReportsApi } from '../../../src/features/reports/logic/service';
import { buildReportHtml, renderReportPart, type ReportPart } from '../../../src/features/reports/logic/rendering/index';
import { rpc, fetchAll } from '../../../src/lib/db/rpc';
import { permissions } from '../../../src/lib/permissions';
import { format } from '../../../src/lib/format';
import { createAuthService } from '../../../src/lib/auth/service';
import { createStorageService } from '../../../src/lib/storage/service';
import { cloudActor, cloudClients, cloudEnvironment, cloudOwner } from '../../auth/support/cloud';
import { inspectPdf, must, pdfWithPages, readArtifact } from './support/artifacts';

// Real RPC, RLS, Storage and Chromium. Every user, project, entry and file changed here is created
// by this run. Changes go through product RPCs and services only. remove_membership and the local
// sign-out touch only the membership and session that this run created.
const executablePath = process.env.REPORT_TEST_CHROME;
const dates = { files: '2026-11-18', plain: '2026-11-19', empty: '2026-11-10', moved: '2026-11-16', many: '2026-11-12' };

let platform: Platform;
let diary: ReturnType<typeof createDiaryApi>;
let owner: RequestContext, worker: RequestContext, outsider: RequestContext, oldMember: RequestContext, newMember: RequestContext;
let removed: RequestContext, removedWhileRendering: RequestContext, leaving: RequestContext;
let projectA: string, projectB: string, completedProject: string;
let withFiles: string, plain: string, moved: string, cancelled: string, inCompleted: string;
let pdfFile: string, imageFile: string, movedFile: string, cancelledFile: string;
let originalPdf: Uint8Array;
const marker = randomUUID();
const body = (name: string) => `בדוי ${name} ${marker}`;

function reports(beforeHandOver?: () => Promise<unknown>) {
  const parts: ReportPart[] = [];
  const render: typeof renderReportPart = async part => {
    parts.push(part);
    const result = await renderReportPart(part, executablePath ? { executablePath } : undefined);
    await beforeHandOver?.();
    return result;
  };
  return { api: createReportsApi(platform, { render }), parts };
}

async function print(ctx: RequestContext, scope: ReportScope) {
  const { api, parts } = reports();
  const artifact = must(await api.renderReportPart(ctx, { scope, part: 1 }));
  expect(artifact.contentType).toBe('application/pdf');
  const { bytes } = await readArtifact(artifact);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  return { part: parts[0], pdf: await inspectPdf(bytes), html: await buildReportHtml(parts[0]) };
}

async function expectRefused(ctx: RequestContext, scope: ReportScope, ...codes: string[]) {
  const { api, parts } = reports();
  const results: Result<unknown>[] = [await api.planReport(ctx, { scope }), await api.renderReportPart(ctx, { scope, part: 1 })];
  for (const result of results) {
    expect(result.ok).toBe(false);
    if (!result.ok) expect(codes).toContain(result.error.code);
  }
  expect(parts).toEqual([]);
}

const day = (projectId: string, date: string): ReportScope => ({ kind: 'day', projectId, date });
const entry = (entryId: string): ReportScope => ({ kind: 'entry', entryId });

async function createProject(label: string) {
  return must(await rpc<unknown, Saved>(owner, 'create_project', {
    requestId: randomUUID(),
    fields: {
      name: `reports ${label} ${randomUUID()}`, businessName: 'בדוי', siteAddress: 'בדיקה',
      contact: { name: 'בדוי', phone: '0', email: null, roleTitle: null }, startDate: null, endDate: null, accessNotes: null,
    },
  }));
}
async function join(ctx: RequestContext, projectId: string) {
  must(await rpc(owner, 'set_membership', { userId: ctx.actor.userId, projectId, role: 'worker', expectedRevision: null }));
}
async function removeFrom(ctx: RequestContext, projectId: string) {
  must(await rpc(owner, 'remove_membership', { userId: ctx.actor.userId, projectId, expectedRevision: 1 }));
}
async function upload(projectId: string, content: Uint8Array, mime: string, name: string) {
  const targets = must(await platform.storage.beginUpload(worker, {
    purpose: 'diary', projectId, files: [{ clientId: randomUUID(), name, mime, sizeBytes: content.byteLength }],
  }));
  const target = must(targets[0].target);
  const sent = await cloudClients().publicClient().storage.from(target.bucket)
    .uploadToSignedUrl(target.path, target.token, content, { contentType: mime });
  expect(sent.error).toBeNull();
  return must(await platform.storage.finishUpload(worker, { fileId: target.fileId }));
}
async function report(projectId: string, workDate: string, text: string, fileIds: string[] = []) {
  return must(await diary.createEntry(worker, { requestId: randomUUID(), projectId, workDate, body: text, fileIds })).id;
}

beforeAll(async () => {
  if (process.platform !== 'linux' && !executablePath) throw new Error('נדרש REPORT_TEST_CHROME להפקה אמיתית');
  const env = cloudEnvironment();
  platform = {
    rpc, fetchAll, permissions, format,
    storage: createStorageService({ privileged: () => cloudClients().admin, url: env.url, publishableKey: env.key }),
  } as Platform;
  diary = createDiaryApi(platform);

  owner = await cloudOwner();
  const newUser = async (label: string) => (await cloudActor(owner, `reports-${label}`)).ctx;
  worker = await newUser('worker');
  outsider = await newUser('outsider');
  oldMember = await newUser('old');
  newMember = await newUser('new');
  removed = await newUser('removed');
  removedWhileRendering = await newUser('removed-render');
  leaving = await newUser('leaving');

  projectA = (await createProject('a')).id;
  projectB = (await createProject('b')).id;
  const toComplete = await createProject('completed');
  completedProject = toComplete.id;
  for (const id of [projectA, projectB, completedProject]) await join(worker, id);
  for (const ctx of [oldMember, removed, removedWhileRendering, leaving]) await join(ctx, projectA);
  await join(newMember, projectB);

  originalPdf = await pdfWithPages(231, 232);
  const photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#268264' } }).png().toBuffer();
  const storedPdf = await upload(projectA, originalPdf, 'application/pdf', 'תוכנית.pdf');
  const storedImage = await upload(projectA, photo, 'image/png', 'צילום.png');
  expect(storedImage.displayState).toBe('ready');
  pdfFile = storedPdf.id;
  imageFile = storedImage.id;
  withFiles = await report(projectA, dates.files, body('עם קבצים'), [pdfFile, imageFile]);
  plain = await report(projectA, dates.plain, body('בלי קבצים'));

  cancelledFile = (await upload(projectA, await pdfWithPages(233), 'application/pdf', 'מבוטל.pdf')).id;
  cancelled = await report(projectA, dates.files, body('מבוטל'), [cancelledFile]);
  must(await diary.cancelEntry(owner, { id: cancelled, expectedRevision: 1 }));

  movedFile = (await upload(projectA, await pdfWithPages(234), 'application/pdf', 'הועבר.pdf')).id;
  moved = await report(projectA, dates.moved, body('לפני תיקון'), [movedFile]);
  must(await diary.correctEntry(worker, { id: moved, expectedRevision: 1, body: body('הועבר'), fileIds: [movedFile] }));
  must(await diary.moveEntry(owner, { id: moved, expectedRevision: 2, projectId: projectB, workDate: dates.moved }));

  inCompleted = await report(completedProject, dates.files, body('הסתיים'));
  must(await rpc(owner, 'set_project_status', { id: completedProject, expectedRevision: toComplete.revision, status: 'completed' }));
}, 180_000);

describe.sequential('ReportsApi over real RPC, RLS, Storage and Chromium', () => {
  it('a worker prints a day with its PDF and image, and their actual content', async () => {
    const { part, pdf, html } = await print(worker, day(projectA, dates.files));
    expect(part.entries.map(item => item.id)).toEqual([withFiles]);
    const [document, image] = part.entries[0].attachments!;
    expect(Buffer.from(document.bytes).equals(Buffer.from(originalPdf))).toBe(true);
    const display = must(await platform.storage.readBytes(worker, { fileId: imageFile, variant: 'display' }));
    expect(image.mediaType).toBe('image/jpeg');
    expect(Buffer.from(image.bytes).equals(Buffer.from(display))).toBe(true);
    for (const text of [body('עם קבצים'), worker.actor.fullName, '18.11.2026', part.projectName]) expect(html).toContain(text);
    expect(pdf.widths.slice(-2)).toEqual([231, 232]);
    expect(pdf.images).toContainEqual(expect.objectContaining({ width: 900, height: 600 }));
  }, 90_000);

  it('a worker prints a range and a single entry', async () => {
    const scope: ReportScope = { kind: 'range', projectId: projectA, from: dates.files, to: dates.plain };
    expect(must(await reports().api.planReport(worker, { scope }))).toEqual({ scope, partCount: 1, entryCount: 2, workDays: 2 });
    const ranged = await print(worker, scope);
    expect(ranged.part.entries.map(item => item.id)).toEqual([withFiles, plain]);
    expect(ranged.html).toContain(body('בלי קבצים'));
    expect(ranged.pdf.widths.slice(-2)).toEqual([231, 232]);

    const single = await print(worker, entry(withFiles));
    expect(single.part.entries.map(item => item.id)).toEqual([withFiles]);
    expect(single.pdf.widths.slice(-2)).toEqual([231, 232]);
  }, 120_000);

  it('an empty day is a printable report', async () => {
    const scope = day(projectA, dates.empty);
    expect(must(await reports().api.planReport(worker, { scope }))).toEqual({ scope, partCount: 1, entryCount: 0, workDays: 0 });
    const { pdf, html } = await print(worker, scope);
    expect(pdf.widths).toHaveLength(1);
    expect(html).toContain('אין דיווחים');
  }, 90_000);

  it('counts and prints every entry beyond a diary page', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 52; i++) ids.push(await report(projectA, dates.many, body(`ספירה ${i}`)));
    const scope = day(projectA, dates.many);
    expect(must(await reports().api.planReport(worker, { scope }))).toEqual({ scope, partCount: 1, entryCount: 52, workDays: 1 });
    expect((await print(worker, scope)).part.entries.map(item => item.id).sort()).toEqual([...ids].sort());
  }, 180_000);

  it.each([0, 2, 1.5])('part %s is invalid', async part => {
    const { api, parts } = reports();
    expect(await api.renderReportPart(worker, { scope: day(projectA, dates.files), part }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(parts).toEqual([]);
  });

  it('an outsider gets nothing by project or by entry id', async () => {
    await expectRefused(outsider, day(projectA, dates.files), 'NOT_FOUND');
    await expectRefused(outsider, { kind: 'range', projectId: projectA, from: dates.files, to: dates.plain }, 'NOT_FOUND');
    await expectRefused(outsider, entry(withFiles), 'NOT_FOUND');
  });

  it('blocked file ids cannot be read directly', async () => {
    for (const [fileId, variant] of [[pdfFile, 'original'], [imageFile, 'original'], [imageFile, 'display']] as const) {
      expect(await platform.storage.readBytes(outsider, { fileId, variant })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    }
    expect(await platform.storage.readBytes(worker, { fileId: cancelledFile, variant: 'original' }))
      .toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('after a move the old project reveals nothing', async () => {
    await expectRefused(oldMember, entry(moved), 'NOT_FOUND');
    await expectRefused(oldMember, day(projectB, dates.moved), 'NOT_FOUND');
    expect(await diary.listVersions(oldMember, { id: moved })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await platform.storage.readBytes(oldMember, { fileId: movedFile, variant: 'original' }))
      .toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    for (const ctx of [oldMember, owner]) {
      const { part, pdf, html } = await print(ctx, day(projectA, dates.moved));
      expect(part.entries).toEqual([]);
      expect(html).not.toContain(marker);
      expect(pdf.widths).not.toContain(234);
    }
  }, 120_000);

  it('after a move the new project follows current access', async () => {
    const { part, pdf, html } = await print(newMember, day(projectB, dates.moved));
    expect(part.entries.map(item => item.id)).toEqual([moved]);
    expect(html).toContain(body('הועבר'));
    expect(html).not.toContain(body('לפני תיקון'));
    expect(pdf.widths.at(-1)).toBe(234);
    expect(must(await diary.listVersions(newMember, { id: moved })).every(version => version.projectId === projectB)).toBe(true);
    await expectRefused(newMember, day(projectA, dates.moved), 'NOT_FOUND');
  }, 90_000);

  it('a cancelled entry is absent, also for the owner', async () => {
    for (const ctx of [worker, owner]) {
      await expectRefused(ctx, entry(cancelled), 'NOT_FOUND');
      const { part, pdf, html } = await print(ctx, day(projectA, dates.files));
      expect(part.entries.map(item => item.id)).toEqual([withFiles]);
      expect(html).not.toContain(body('מבוטל'));
      expect(pdf.widths).not.toContain(233);
    }
  }, 120_000);

  it('a completed project stays printable', async () => {
    expect(must(await permissions.forProject(worker, { projectId: completedProject }))).toMatchObject({ view: true, report: false });
    expect((await print(worker, day(completedProject, dates.files))).html).toContain(body('הסתיים'));
    expect((await print(worker, entry(inCompleted))).part.entries).toHaveLength(1);
  }, 120_000);

  it('a removed member with the same JWT loses the report, the entry and the file', async () => {
    must(await reports().api.planReport(removed, { scope: day(projectA, dates.files) }));
    await removeFrom(removed, projectA);
    await expectRefused(removed, day(projectA, dates.files), 'NOT_FOUND');
    await expectRefused(removed, entry(withFiles), 'NOT_FOUND');
    expect(await platform.storage.readBytes(removed, { fileId: pdfFile, variant: 'original' }))
      .toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('membership removed during rendering hands over no bytes', async () => {
    const { api, parts } = reports(() => removeFrom(removedWhileRendering, projectA));
    const result = await api.renderReportPart(removedWhileRendering, { scope: day(projectA, dates.files), part: 1 });
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(parts).toHaveLength(1);
  }, 90_000);

  it('a signed-out session cannot use a context that was already created', async () => {
    const session = (await leaving.db.auth.getSession()).data.session;
    if (!session) throw new Error('חסר סשן בדיקה');
    const env = cloudEnvironment();
    const token = session.access_token;
    // Keeps the JWT after supabase-js forgets it, like a request already in flight.
    const held: RequestContext = { ...leaving, db: createClient(env.url, env.key, { accessToken: async () => token }) as Db };
    must(await reports().api.planReport(held, { scope: day(projectA, dates.files) }));

    const auth = createAuthService({ db: leaving.db, authClient: cloudClients().publicClient() });
    expect(await auth.signOut()).toEqual({ ok: true, value: null }); // scope: local, synthetic user only

    await expectRefused(held, day(projectA, dates.files), 'UNAUTHENTICATED');
    await expectRefused(held, entry(withFiles), 'UNAUTHENTICATED', 'NOT_FOUND'); // RLS hides the row first
    expect(await platform.storage.readBytes(held, { fileId: pdfFile, variant: 'original' }))
      .toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  });
});
