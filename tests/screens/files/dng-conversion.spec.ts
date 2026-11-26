import {test,expect,type Page} from '@playwright/test';
import {createServer,type ViteDevServer} from 'vite';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {dng} from '../../shell/dng/fixtures';
test.use({trace:'off',screenshot:'off',video:'off'});
const root=fileURLToPath(new URL('../../../',import.meta.url));
let server:ViteDevServer,origin:string,jpeg:Buffer;
test.beforeAll(async()=>{
 jpeg=await sharp({create:{width:1600,height:1200,channels:3,background:'#cc6633'}}).jpeg().toBuffer();
 server=await createServer({root,cacheDir:'/private/tmp/ozma-dng-vite-cache',configFile:false,envDir:false,resolve:{alias:{'@':`${root}src`}},optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-dev-runtime','tus-js-client','zod']},oxc:{jsx:{runtime:'automatic'}},server:{host:'127.0.0.1',port:0},plugins:[{name:'dng-harness',enforce:'pre',resolveId(id){if(id==='next/link')return '\0link';if(id==='next/navigation')return '\0router';if(id==='virtual:dng')return '\0dng';},load(id){if(id==='\0link')return `import React from 'react';export default function Link(p){return React.createElement('a',p)}`;if(id==='\0router')return `export const useParams=()=>({});export const usePathname=()=>'/';export const useRouter=()=>({refresh(){}});export const useSearchParams=()=>new URLSearchParams();`;if(id==='\0dng')return `import React from 'react';import{createRoot}from'react-dom/client';import{FileUpload}from'@/components/upload/FileUpload';import '@/styles/app.css';createRoot(document.getElementById('root')).render(React.createElement(FileUpload,{purpose:new URLSearchParams(location.search).get('purpose')||'diary',projectId:'11111111-1111-4111-8111-111111111111',onUploaded:f=>window.uploaded=f,onBusyChange:b=>window.busy=b}));`;},configureServer(s){s.middlewares.use((req,res,next)=>{if(!req.url?.startsWith('/harness'))return next();res.setHeader('Content-Type','text/html');res.end('<html lang="he" dir="rtl"><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="root"></div><script type="module" src="/@id/__x00__dng"></script></body></html>');});}}]});await server.listen();origin=server.resolvedUrls!.local[0].replace(/\/$/,'');
});
test.afterAll(async()=>{await server?.close();});
async function setup(page:Page,purpose='diary',failFirst=false){
 page.on('console',m=>{if(m.type()==='error')console.error(m.text())});page.on('requestfailed',r=>console.error('failed',new URL(r.url()).pathname));page.on('pageerror',e=>console.error('DNG harness:',e.message));const begun:{files:{name:string;mime:string;sizeBytes:number}[]}[]=[],bodies:Buffer[]=[];let ref:object={};
 await page.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==origin)return route.abort();
 if(u.pathname==='/api/storage/uploads'){const body=r.postDataJSON();begun.push(body);if(failFirst&&begun.length===1)return route.fulfill({json:{ok:false,error:{code:'UNAVAILABLE',message:'כשל בדיקה'}}});ref={id:'fixture',...body.files[0],displayState:'ready'};return route.fulfill({json:{ok:true,value:body.files.map((f:{clientId:string})=>({clientId:f.clientId,target:{ok:true,value:{fileId:'fixture',endpoint:origin+'/tus',bucket:'fake',path:'fake',token:'fake',publishableKey:'fake'}}}))}});}
 if(u.pathname==='/tus'&&r.method()==='POST')return route.fulfill({status:201,headers:{Location:'/tus/data','Tus-Resumable':'1.0.0'}});
 if(u.pathname==='/tus/data'){bodies.push(r.postDataBuffer()!);return route.fulfill({status:204,headers:{'Upload-Offset':String(r.postDataBuffer()!.length),'Tus-Resumable':'1.0.0'}});}
 if(u.pathname.endsWith('/complete'))return route.fulfill({json:{ok:true,value:ref}});return route.continue();});
 await page.goto(origin+'/harness?purpose='+purpose);return{begun,bodies};
}
async function photo(orientation=6){return {name:'synthetic.DNG',mimeType:'application/octet-stream',buffer:Buffer.from(await dng(jpeg,true,orientation).arrayBuffer())};}
for(const width of [360,375,390,768,1024,1280])test(`DNG becomes JPEG at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const f=await setup(page);const input=await photo();
 // Source exceeds 25MiB, but the prepared JPEG must not inherit this limit.
 if(width===390)input.buffer=Buffer.concat([input.buffer,Buffer.alloc(26*1024*1024)]);
 await page.locator('input[type=file]').setInputFiles(input);await expect.poll(()=>f.bodies.length).toBe(1);
 expect(f.begun[0].files[0]).toMatchObject({name:'synthetic.jpg',mime:'image/jpeg'});
 const m=await sharp(f.bodies[0]).metadata();expect(m).toMatchObject({format:'jpeg',width:1200,height:1600});expect(m.exif).toBeUndefined();expect(f.bodies[0].length).toBeLessThan(100_000);
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {busy:boolean}).busy)).toBe(false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('failure never begins upload; retry sends the same prepared JPEG',async({page})=>{
 const f=await setup(page,'document',true);await page.locator('input[type=file]').setInputFiles({name:'bad.dng',mimeType:'',buffer:Buffer.from('not a DNG')});await expect(page.getByText(/לא ניתן להמיר/)).toBeVisible();expect(f.begun).toHaveLength(0);
 await page.getByRole('button',{name:'הסרת bad.dng'}).click();await page.locator('input[type=file]').setInputFiles(await photo());await expect(page.getByRole('button',{name:'ניסיון חוזר לsynthetic.jpg'})).toBeVisible();await page.getByRole('button',{name:'ניסיון חוזר לsynthetic.jpg'}).click();await expect.poll(()=>f.bodies.length).toBe(1);expect(f.begun[1].files[0]).toEqual(f.begun[0].files[0]);
});
test('cancel a queued preparation before any bytes are sent',async({page})=>{
 const f=await setup(page);await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends Native{postMessage(){/* Hold conversion for cancellation fixture. */}};});
 await page.reload();await page.locator('input[type=file]').setInputFiles(await photo());await expect(page.getByText('מכין תמונה להעלאה…')).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as unknown as {busy:boolean}).busy)).toBe(true);await page.getByRole('button',{name:'ביטול הכנת synthetic.DNG'}).click();await expect(page.locator('.upload__item')).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>(window as unknown as {busy:boolean}).busy)).toBe(false);expect(f.begun).toHaveLength(0);
});

for (const orientation of [1,2,3,4,5,6,7,8]) test(`renders asymmetric corners with orientation ${orientation}`,async({page})=>{
 const f=await setup(page,'cover');
 const svg=Buffer.from('<svg width="1600" height="1200"><path fill="#ff0000" d="M0 0h800v600H0z"/><path fill="#00ff00" d="M800 0h800v600H800z"/><path fill="#0000ff" d="M0 600h800v600H0z"/><path fill="#ffff00" d="M800 600h800v600H800z"/></svg>');
 const j=await sharp(svg).jpeg().toBuffer();await page.locator('input[type=file]').setInputFiles({name:'corners.dng',mimeType:'',buffer:Buffer.from(await dng(j,true,orientation).arrayBuffer())});await expect.poll(()=>f.bodies.length).toBe(1);
 const output=f.bodies[0],m=await sharp(output).metadata();
 const colors=[[255,0,0],[0,255,0],[0,0,255],[255,255,0]];
 const expected=[[0,1,2,3],[1,0,3,2],[3,2,1,0],[2,3,0,1],[0,2,1,3],[2,0,3,1],[3,1,2,0],[1,3,0,2]][orientation-1];
 const points=[[10,10],[m.width!-11,10],[10,m.height!-11],[m.width!-11,m.height!-11]];
 for(let i=0;i<4;i++){const rgb=await sharp(output).extract({left:points[i][0],top:points[i][1],width:1,height:1}).raw().toBuffer();for(let c=0;c<3;c++)expect(Math.abs(rgb[c]-colors[expected[i]][c])).toBeLessThan(8);}
});
test('authorized private local sample converts without network transfer',async({page})=>{
 test.skip(!process.env.DNG_LOCAL_SAMPLE,'Opt-in local file only; never run with traces or screenshots');
 const f=await setup(page);await page.locator('input[type=file]').setInputFiles(process.env.DNG_LOCAL_SAMPLE!);await expect.poll(()=>f.bodies.length,{timeout:15000}).toBe(1);const m=await sharp(f.bodies[0]).metadata();expect(m).toMatchObject({format:'jpeg',width:1200,height:1600});expect(f.bodies[0].length).toBeLessThan(200_000);
});
