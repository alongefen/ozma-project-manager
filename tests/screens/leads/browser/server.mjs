// Local fake-data harness only. No Next route, environment override, DB, or shipped auth bypass.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const path=name=>fileURLToPath(new URL(name,import.meta.url));
const server=await createServer({
 configFile:false,cacheDir:'/tmp/ozma-leads-ui-vite',define:{'process.env':'{}'},root:path('../../../..'),
 server:{host:'127.0.0.1',port:4180,strictPort:true},
 resolve:{alias:[{find:'next/navigation',replacement:path('./navigation.ts')},{find:/.*leads\/logic\/actions$|^\.\.\/logic\/actions$/,replacement:path('./actions.ts')},{find:'@',replacement:path('../../../../src')}]},
 plugins:[{name:'fixture-html',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="he" dir="rtl"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><script>window.process={env:{NODE_ENV:"development"}};</script><div id="root"></div><script type="module" src="/tests/screens/leads/browser/fixture.tsx"></script></body></html>');});}}]
});
await server.listen();
console.log('Fake leads fixture: http://127.0.0.1:4180');
