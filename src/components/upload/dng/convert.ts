import {extractPreview,DNG_ERROR} from './parser';
import {inspectJpeg} from './jpeg';

/** Runs in a disposable Worker. The browser decodes only the rendered preview, never RAW. */
export async function convertDng(file: Blob): Promise<Blob> {
  const preview=await extractPreview(file), source=await inspectJpeg(preview.jpeg);
  const orientation=source.orientation ?? preview.orientation;
  const scale=Math.min(1,1600/Math.max(source.width,source.height));
  const w=Math.round(source.width*scale),h=Math.round(source.height*scale);
  const bitmap=await createImageBitmap(source.jpeg,{resizeWidth:w,resizeHeight:h,resizeQuality:'high',colorSpaceConversion:'default'});
  try {
    if(bitmap.width!==w||bitmap.height!==h)throw new Error(DNG_ERROR);
    const swap=orientation>=5,canvas=new OffscreenCanvas(swap?h:w,swap?w:h);
    const ctx=canvas.getContext('2d',{colorSpace:'srgb'});if(!ctx)throw new Error(DNG_ERROR);
    const transforms: Record<number,number[]>={1:[1,0,0,1,0,0],2:[-1,0,0,1,w,0],3:[-1,0,0,-1,w,h],4:[1,0,0,-1,0,h],5:[0,1,1,0,0,0],6:[0,1,-1,0,h,0],7:[0,-1,-1,0,h,w],8:[0,-1,1,0,0,w]};
    const [a,b,c,d,e,f]=transforms[orientation];ctx.setTransform(a,b,c,d,e,f);ctx.drawImage(bitmap,0,0);
    const output=await canvas.convertToBlob({type:'image/jpeg',quality:0.8});
    canvas.width=canvas.height=1;
    if(output.type!=='image/jpeg'||output.size===0||output.size>5*1024*1024)throw new Error(DNG_ERROR);
    return output;
  } finally {bitmap.close();}
}
