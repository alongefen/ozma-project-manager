import {DNG_ERROR,MAX_DNG_BYTES} from './parser';
export const isDngInput=(file:{name:string;type:string}):boolean=>/\.dng$/i.test(file.name)||['image/dng','image/x-adobe-dng'].includes(file.type.toLowerCase());

export function prepareDng(file:File,signal:AbortSignal):Promise<File>{
  if(file.size>MAX_DNG_BYTES)return Promise.reject(new Error('קובץ ה־DNG גדול מדי להמרה במכשיר. המגבלה היא 100MB'));
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(new DOMException('Aborted','AbortError'));return;}
    let worker:Worker;
    try{worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});}catch{reject(new Error(DNG_ERROR));return;}
    const finish=(error?:Error,blob?:Blob)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);worker.terminate();if(error)reject(error);else resolve(new File([blob!],file.name.replace(/\.dng$/i,'')+'.jpg',{type:'image/jpeg',lastModified:file.lastModified}));};
    const abort=()=>finish(new DOMException('Aborted','AbortError'));
    const timer=setTimeout(()=>finish(new Error('המרת התמונה ארכה יותר מדי זמן. יש לייצא JPEG במכשיר ולנסות שוב')),10_000);
    signal.addEventListener('abort',abort,{once:true});
    worker.onmessage=(event:MessageEvent<{ok:boolean;blob?:Blob}>)=>event.data.ok&&event.data.blob instanceof Blob?finish(undefined,event.data.blob):finish(new Error(DNG_ERROR));
    worker.onerror=()=>finish(new Error(DNG_ERROR));
    worker.postMessage(file);
  });
}
