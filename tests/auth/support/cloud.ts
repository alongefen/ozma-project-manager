import {existsSync,readFileSync} from 'node:fs';
import {cloudEnvPath,cloudOwnerPath} from '../../support/cloud-paths';
import {parseEnv} from 'node:util';
import {createClient} from '@supabase/supabase-js';
import {randomBytes, randomUUID} from 'node:crypto';
import type {Db, RequestContext, Actor} from '../../../src/types/contracts';

// Runtime-only fixture loading. Never log these files or returned clients.
export function cloudEnvironment() {
  const envPath=cloudEnvPath();
  const file=existsSync(envPath) ? parseEnv(readFileSync(envPath,'utf8')) : {};
  const get=(key:string)=>process.env[key] || file[key];
  const url=get('SUPABASE_URL'); const key=get('SUPABASE_PUBLISHABLE_KEY'); const secret=get('SUPABASE_SECRET_KEY');
  if(!url || !key || !secret) throw new Error(`חסרות הגדרות ענן; הקובץ הצפוי: ${envPath}`);
  if(new URL(url).hostname!=='izjmvyguzbampoasvnru.supabase.co') throw new Error('יעד הבדיקה אינו פרויקט הפיתוח המאושר');
  return {url,key,secret};
}
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
export function cloudClients() {
  const env=cloudEnvironment();
  return {admin:createClient(env.url,env.secret,options) as Db,publicClient:()=>createClient(env.url,env.key,options) as Db};
}
export async function cloudOwner() {
  const file=cloudOwnerPath();
  if(!existsSync(file)) throw new Error(`חסר קובץ בעלים בדוי; הקובץ הצפוי: ${file}`);
  const credentials=JSON.parse(readFileSync(file,'utf8')) as {email:string;password:string};
  const {publicClient}=cloudClients();const db=publicClient();
  const response=await db.auth.signInWithPassword(credentials);
  if(response.error) throw new Error('כניסת בעלים בדוי נכשלה');
  return context(db);
}
export async function context(db:Db):Promise<RequestContext> {
  const {data,error}=await db.rpc('get_actor',{input:{}});
  if(error || !data) throw new Error('אין הקשר בדיקה מאומת');
  return {db,actor:data as unknown as Actor,today:'2026-11-22'};
}
export async function cloudActor(owner:RequestContext,label:string) {
  const {admin,publicClient}=cloudClients();const db=publicClient();
  const email=`p13-${label}-${randomUUID()}@example.invalid`;
  const password=randomBytes(32).toString('base64url');
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(created.error || !created.data.user) throw new Error('יצירת משתמש בדוי נכשלה');
  const requestId=randomUUID();
  const profile=await owner.db.rpc('create_profile',{input:{requestId,email,fullName:`בדיקה ${label}`}});
  if(profile.error) throw new Error('יצירת פרופיל בדוי נכשלה');
  const completed=await owner.db.rpc('complete_profile_creation',{input:{requestId,userId:created.data.user.id}});
  if(completed.error) throw new Error('השלמת פרופיל בדוי נכשלה');
  const signed=await db.auth.signInWithPassword({email,password});
  if(signed.error) throw new Error('כניסת משתמש בדוי נכשלה');
  return {ctx:await context(db),email,password};
}
