import {afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const captures=vi.hoisted(()=>({server:vi.fn(),client:vi.fn()}));
vi.mock('@supabase/ssr',()=>({createServerClient:captures.server}));
vi.mock('@supabase/supabase-js',()=>({createClient:captures.client}));
import {cookieOptions,createRequestDb,createAuthClient,trustedClientIp} from '../../src/lib/db/clients';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
function setup(){vi.stubEnv('SUPABASE_URL','https://izjmvyguzbampoasvnru.supabase.co');vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','public-fixture');vi.stubEnv('SUPABASE_SECRET_KEY','secret-fixture');}
describe('SSR cookie וגבולות מפתח/IP',()=>{
  it('persistent cookies are HttpOnly Secure SameSite Lax and 400 days',()=>{
    expect(cookieOptions).toMatchObject({httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:400*24*60*60});
  });
  it('untrusted forwarding headers cannot override client identity',()=>{
    vi.stubEnv('VERCEL','1');
    expect(trustedClientIp(new Headers({'x-forwarded-for':'198.51.100.11'}))).toBeUndefined();
    expect(trustedClientIp(new Headers({'x-vercel-forwarded-for':'198.51.100.11'}))).toBe('198.51.100.11');
    expect(trustedClientIp(new Headers({'x-vercel-forwarded-for':'invalid'}))).toBeUndefined();
    vi.stubEnv('VERCEL','');expect(trustedClientIp(new Headers({'x-vercel-forwarded-for':'198.51.100.11'}))).toBeUndefined();
  });
  it('refresh uses Auth secret/IP only at the same-origin token endpoint; data uses user credentials',async()=>{
    setup();const network=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',network);
    createRequestDb({getAll:()=>[],setAll:()=>{}},'198.51.100.11');
    expect(captures.server.mock.calls[0][1]).toBe('public-fixture');
    const customFetch=captures.server.mock.calls[0][2].global.fetch;
    await customFetch('https://izjmvyguzbampoasvnru.supabase.co/auth/v1/token?grant_type=refresh_token',{headers:{apikey:'public-fixture',Authorization:'Bearer fixture-user-token'}});
    let options=network.mock.calls[0][1];expect(options.headers.get('apikey')).toBe('secret-fixture');expect(options.headers.get('Sb-Forwarded-For')).toBe('198.51.100.11');expect(options.cache).toBe('no-store');
    await customFetch('https://izjmvyguzbampoasvnru.supabase.co/rest/v1/projects',{headers:{apikey:'public-fixture',Authorization:'Bearer fixture-user-token'}});
    options=network.mock.calls[1][1];expect(options.headers.get('apikey')).toBe('public-fixture');expect(options.headers.get('Authorization')).toBe('Bearer fixture-user-token');expect(options.headers.has('Sb-Forwarded-For')).toBe(false);
    await customFetch('https://other.invalid/auth/v1/token',{headers:{apikey:'public-fixture'}});expect(network.mock.calls[2][1].headers.get('apikey')).toBe('public-fixture');
  });
  it('password Auth client forwards IP without persistent browser storage',()=>{
    setup();createAuthClient('198.51.100.11');
    expect(captures.client).toHaveBeenCalledWith(expect.any(String),'secret-fixture',expect.objectContaining({auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{'Sb-Forwarded-For':'198.51.100.11'}}}));
  });
});
