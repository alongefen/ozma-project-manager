import {randomBytes,randomUUID} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {cloudClients,cloudEnvironment} from './support/cloud';

describe.sequential('אימות ממוקד של הגדרות Auth לאחר הגדרת אלון',()=>{
  it('disables signup and non-email providers while keeping email confirmation off',async()=>{
    const env=cloudEnvironment();
    const response=await fetch(`${env.url}/auth/v1/settings`,{headers:{apikey:env.key}});
    expect(response.status).toBe(200);
    const settings=await response.json() as {disable_signup:boolean;mailer_autoconfirm:boolean;external:Record<string,boolean>};
    console.info('Auth settings summary', {disableSignup:settings.disable_signup,emailConfirmation:!settings.mailer_autoconfirm,emailProvider:settings.external.email,otherEnabledProviders:Object.entries(settings.external).filter(([name,enabled])=>name!=='email' && enabled).map(([name])=>name)});
    expect.soft(settings.disable_signup).toBe(true);
    expect.soft(settings.mailer_autoconfirm).toBe(true);
    expect(settings.external.email).toBe(true);
    expect(Object.entries(settings.external).filter(([name,enabled])=>name!=='email' && enabled).map(([name])=>name)).toEqual([]);
  });
  it('rejects a seven-character password before creating an Auth user',async()=>{
    const {admin}=cloudClients();
    const response=await admin.auth.admin.createUser({email:`p13-short-${randomUUID()}@example.invalid`,password:'Abc12!?',email_confirm:true});
    expect(response.error?.code).toBe('weak_password');
    expect(response.data.user).toBeNull();
  });
  it('rejects TOTP enrollment for a new synthetic Auth-only account',async()=>{
    const {admin,publicClient}=cloudClients();
    const email=`p13-mfa-${randomUUID()}@example.invalid`,password=randomBytes(32).toString('base64url');
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
    if(created.error)throw new Error(`יצירת חשבון בדוי נכשלה: ${created.error.code ?? 'unknown'}`);
    const client=publicClient();
    const signed=await client.auth.signInWithPassword({email,password});
    if(signed.error)throw new Error(`כניסת חשבון בדוי נכשלה: ${signed.error.code ?? 'unknown'}`);
    const enrolled=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'בדיקת חסימה'});
    // Never print enrollment data: if configuration is wrong it could contain a secret.
    console.info('MFA enrollment summary',{hasError:enrolled.error!==null,errorCode:enrolled.error?.code ?? null,errorStatus:enrolled.error?.status ?? null,hasEnrollment:enrolled.data!==null});
    await client.auth.signOut({scope:'local'});
    expect(enrolled.error?.code).toBe('mfa_totp_enroll_not_enabled');
    expect(enrolled.data===null).toBe(true);
  });
});
