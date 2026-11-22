import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { DocumentAccess, DocumentCategory, Platform, RequestContext, Result } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { createFilesApi } from '../../../src/features/files/logic';
import { rpc, fetchAll } from '../../../src/lib/db/rpc';
import { permissions } from '../../../src/lib/permissions';
import { format } from '../../../src/lib/format';
import { createStorageService } from '../../../src/lib/storage/service';
import { cloudActor, cloudClients, cloudEnvironment, cloudOwner } from '../../auth/support/cloud';
const unwrap = <T>(r: Result<T>): T => { if (!r.ok) throw new Error(`files fixture: ${r.error.code}`); return r.value; };
let ben: RequestContext, manager: RequestContext, worker: RequestContext, outsider: RequestContext, projectId: string;
let platform: Platform;
const name = `מסמך_${randomUUID()}.png`;
const docs: { id: string; fileId: string; category: DocumentCategory; revision: number }[] = [];
const categories = ['specification', 'plans', 'additional_plans', 'renderings'] as const;
beforeAll(async () => {
  ben = await cloudOwner();
  manager = (await cloudActor(ben, 'files-manager')).ctx;
  worker = (await cloudActor(ben, 'files-worker')).ctx;
  outsider = (await cloudActor(ben, 'files-other')).ctx;
  projectId = unwrap(await rpc<{requestId: string; fields: unknown}, {id: string}>(ben, 'create_project', { requestId: randomUUID(), fields: { name: `files ${randomUUID()}`, businessName: 'בדוי', siteAddress: 'בדיקה', contact: {name: 'בדוי', phone: '0', email: null, roleTitle: null}, startDate: null, endDate: null, accessNotes: null } })).id;
  for (const [ctx, role] of [[manager, 'manager'], [worker, 'worker']] as const) unwrap(await rpc(ben, 'set_membership', { userId: ctx.actor.userId, projectId, role, expectedRevision: null }));
  const env = cloudEnvironment();
  platform = { rpc, fetchAll, permissions, format, storage: createStorageService({ privileged: () => cloudClients().admin, url: env.url, publishableKey: env.key }) } as Platform;
  const access: DocumentAccess[] = [{mode:'all'}, {mode:'owner'}, {mode:'selected',userIds:[worker.actor.userId]}, {mode:'all'}];
  for (let i=0;i<categories.length;i++) {
    const fileId = await upload(manager);
    const saved = unwrap(await createFilesApi(platform).createDocument(manager, {projectId,fileId,category:categories[i],access:access[i]}));
    docs.push({...saved,fileId,category:categories[i]});
  }
}, 90_000);
async function upload(ctx: RequestContext) {
  const png = await sharp({create:{width:8,height:8,channels:3,background:'#123456'}}).png().toBuffer();
  const targets=unwrap(await platform.storage.beginUpload(ctx,{purpose:'document',projectId,files:[{clientId:randomUUID(),name,mime:'image/png',sizeBytes:png.length}]}));
  const t=unwrap(targets[0].target);
  const sent=await cloudClients().publicClient().storage.from(t.bucket).uploadToSignedUrl(t.path,t.token,png,{contentType:'image/png'});
  expect(sent.error).toBeNull(); unwrap(await platform.storage.finishUpload(ctx,{fileId:t.fileId})); return t.fileId;
}
describe.sequential('FilesApi through the real server and existing storage', () => {
  it('lists four categories for owner, hides owner-only and unselected uploader metadata/count/search', async () => {
    const api=createFilesApi(platform);
    const owner=unwrap(await api.listDocuments(ben,{projectId})); expect(owner.items).toHaveLength(4); expect(owner.countByCategory).toEqual({specification:1,plans:1,additional_plans:1,renderings:1});
    const m=unwrap(await api.listDocuments(manager,{projectId,search:name})); expect(m.items).toHaveLength(2); expect(m.countByCategory.plans).toBe(0); expect(m.countByCategory.additional_plans).toBe(0); expect(m.items.every(x=>x.access===undefined)).toBe(true);
    expect(await api.getDocument(manager,{id:docs[1].id})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    expect(await api.getDocument(manager,{id:docs[2].id})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    expect(unwrap(await api.listDocuments(worker,{projectId})).items).toHaveLength(3);
    expect(unwrap(await api.listDocuments(manager,{projectId,category:'specification'})).items).toHaveLength(1);
    expect(unwrap(await api.listDocuments(manager,{projectId,search:'does-not-exist'})).items).toEqual([]);
  });
  it('returns candidate names and ids only, rejects outsider and invalid selected members', async () => {
    const api=createFilesApi(platform); const names=unwrap(await api.listAccessCandidates(manager,{projectId})); expect(names).toHaveLength(2);
    for(const row of names) expect(Object.keys(row).sort()).toEqual(['fullName','userId']);
    expect((await api.listAccessCandidates(outsider,{projectId})).ok).toBe(false);
    const fileId=await upload(manager);
    expect((await api.createDocument(manager,{projectId,fileId,category:'plans',access:{mode:'selected',userIds:[outsider.actor.userId]}})).ok).toBe(false);
    expect((await api.createDocument(manager,{projectId,fileId,category:'plans',access:{mode:'selected',userIds:[]}})).ok).toBe(false);
  });
  it('opens and downloads only allowed originals using Platform.storage', async () => {
    const allowed=unwrap(await platform.storage.getSignedUrl(worker,{fileId:docs[0].fileId,variant:'original',download:false})); expect(allowed.expiresInSeconds).toBe(60);
    expect((await platform.storage.getSignedUrl(worker,{fileId:docs[0].fileId,variant:'original',download:true})).ok).toBe(true);
    expect(await platform.storage.getSignedUrl(manager,{fileId:docs[1].fileId,variant:'original',download:true})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    expect((await platform.storage.getSignedUrl(outsider,{fileId:docs[0].fileId,variant:'original',download:false})).ok).toBe(false);
  });
  it('only owner changes access/archive/replacement; replacement preserves old original', async () => {
    const api=createFilesApi(platform);
    expect((await api.setDocumentAccess(manager,{id:docs[0].id,expectedRevision:1,access:{mode:'owner'}})).ok).toBe(false);
    expect((await api.setDocumentArchived(manager,{id:docs[0].id,expectedRevision:1,archived:true})).ok).toBe(false);
    const fileId=await upload(manager);
    expect((await api.createDocument(manager,{projectId,fileId,category:'plans',access:{mode:'all'},replacesDocumentId:docs[0].id})).ok).toBe(false);
    const changed=unwrap(await api.setDocumentAccess(ben,{id:docs[0].id,expectedRevision:1,access:{mode:'owner'}}));
    expect(await api.getDocument(manager,{id:docs[0].id})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    unwrap(await api.setDocumentArchived(ben,{id:docs[0].id,expectedRevision:changed.revision,archived:true}));
    expect(unwrap(await api.listDocuments(ben,{projectId,archived:true})).items.some(x=>x.id===docs[0].id)).toBe(true);
    unwrap(await api.createDocument(ben,{projectId,fileId:await upload(ben),category:'plans',access:{mode:'all'},replacesDocumentId:docs[1].id}));
    expect((await platform.storage.readBytes(ben,{fileId:docs[1].fileId,variant:'original'})).ok).toBe(true);
  });
  it('removed member with the same JWT loses list/detail/search/signing', async () => {
    unwrap(await rpc(ben,'remove_membership',{userId:worker.actor.userId,projectId,expectedRevision:1}));
    const api=createFilesApi(platform); const listed=await api.listDocuments(worker,{projectId,search:name});
    if(listed.ok) {expect(listed.value.items).toEqual([]);expect(Object.values(listed.value.countByCategory)).toEqual([0,0,0,0]);}
    expect(await api.getDocument(worker,{id:docs[3].id})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    expect((await platform.storage.getSignedUrl(worker,{fileId:docs[3].fileId,variant:'original',download:true})).ok).toBe(false);
  });
});
