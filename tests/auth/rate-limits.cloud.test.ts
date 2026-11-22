import {randomBytes,randomInt,randomUUID} from 'node:crypto';
import {describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {createAuthClient,createRequestDb} from '../../src/lib/db/clients';
import {cloudClients,cloudEnvironment} from './support/cloud';
function setup(){const env=cloudEnvironment();vi.stubEnv('SUPABASE_URL',env.url);vi.stubEnv('SUPABASE_PUBLISHABLE_KEY',env.key);vi.stubEnv('SUPABASE_SECRET_KEY',env.secret);return env;}
const freshIp=()=>`198.18.${randomInt(1,255)}.${randomInt(1,255)}`;

describe.sequential('Auth: TTL, forwarded IP and bounded rate-limit probe',()=>{
  it('SSR cookies restore a session in a new request and refresh it with the same authenticated user',async()=>{
    setup();const {admin}=cloudClients();const email=`p13-ssr-${randomUUID()}@example.invalid`,password=randomBytes(32).toString('base64url');
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw new Error('יצירת חשבון SSR בדוי נכשלה');
    const ip=freshIp();const signed=await createAuthClient(ip).auth.signInWithPassword({email,password});if(signed.error || !signed.data.session)throw new Error('כניסת SSR בדויה נכשלה');
    const values=new Map<string,string>();let wroteHttpOnly=false;
    const jar={getAll:()=>Array.from(values,([name,value])=>({name,value})),setAll:(cookies:{name:string;value:string;options:{httpOnly?:boolean;maxAge?:number}}[])=>{for(const cookie of cookies){values.set(cookie.name,cookie.value);if(cookie.options.httpOnly && cookie.options.maxAge===400*24*60*60)wroteHttpOnly=true;}}};
    const first=createRequestDb(jar,ip);
    const saved=await first.auth.setSession({access_token:signed.data.session.access_token,refresh_token:signed.data.session.refresh_token});expect(saved.error?.code).toBeUndefined();expect(values.size).toBeGreaterThan(0);expect(wroteHttpOnly).toBe(true);
    const next=createRequestDb(jar,ip);
    const restored=await next.auth.getUser();expect(restored.data.user?.id).toBe(signed.data.user.id);
    const refreshed=await next.auth.refreshSession();expect(refreshed.error?.code).toBeUndefined();expect(refreshed.data.user?.id).toBe(signed.data.user.id);expect(refreshed.data.session!==null).toBe(true);
    const after=createRequestDb(jar,ip);expect((await after.auth.getUser()).data.user?.id).toBe(signed.data.user.id);
    expect((await after.auth.signOut({scope:'local'})).error?.code).toBeUndefined();
  });

  it('preflight: issues a one-hour JWT through the Auth-only forwarded-IP client',async()=>{
    const env=setup();expect(env.secret.startsWith('sb_secret_')).toBe(true);
    const {admin}=cloudClients();const email=`p13-ip-${randomUUID()}@example.invalid`,password=randomBytes(32).toString('base64url');
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
    if(created.error)throw new Error('יצירת חשבון IP בדוי נכשלה');
    const ip=freshIp();const client=createAuthClient(ip);
    const signed=await client.auth.signInWithPassword({email,password});
    if(signed.error || !signed.data.session)throw new Error(`כניסת בדיקת IP נכשלה: ${signed.error?.code ?? 'unknown'}`);
    const claims=JSON.parse(Buffer.from(signed.data.session.access_token.split('.')[1],'base64url').toString()) as {exp:number;iat:number};
    console.info('Forwarding preflight evidence',{userId:signed.data.user.id,expectedIp:ip,jwtLifetimeSeconds:claims.exp-claims.iat});
    expect(claims.exp-claims.iat).toBe(3600);
    // Keep this synthetic session for a boolean-only auth.sessions IP comparison by the test coordinator.
  });
  it.skipIf(!process.env.P13_VERIFIED_FORWARDED_IP)('bounded probe: isolated verified IP is throttled while another IP can still authenticate',async()=>{
    setup();
    const ip=process.env.P13_VERIFIED_FORWARDED_IP;
    if(!ip || !/^198\.18\.\d{1,3}\.\d{1,3}$/.test(ip)) throw new Error('נדרש P13_VERIFIED_FORWARDED_IP לאחר אימות auth.sessions; אין לבדוק את IP השרת');
    const results:({status:number|undefined;code:string|undefined})[]=[];
    for(let n=0;n<32;n++) {
      const response=await createAuthClient(ip).auth.signInWithPassword({email:`absent-${randomUUID()}@example.invalid`,password:'incorrect-fixture-password'});
      results.push({status:response.error?.status,code:response.error?.code});
      if(response.error?.status===429)break;
    }
    const {admin}=cloudClients();const email=`p13-ip-control-${randomUUID()}@example.invalid`,password=randomBytes(32).toString('base64url');
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw new Error('יצירת חשבון בקרה נכשלה');
    const control=createAuthClient(freshIp());const signed=await control.auth.signInWithPassword({email,password});
    console.info('Bounded rate-limit evidence',{attempts:results.length,throttled:results.some(r=>r.status===429),lastCode:results.at(-1)?.code,controlSucceeded:!signed.error});
    expect(signed.error?.code).toBeUndefined();
    await control.auth.signOut({scope:'local'});
    expect(results.some(result=>result.status===429)).toBe(true);
  },30000);
});
