import {convertDng} from './convert';
import {DNG_ERROR} from './parser';
self.onmessage=async(event:MessageEvent<Blob>)=>{
  try {self.postMessage({ok:true,blob:await convertDng(event.data)});}
  catch {self.postMessage({ok:false,error:DNG_ERROR});}
};
