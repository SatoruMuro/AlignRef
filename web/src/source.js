// SPDX-License-Identifier: Apache-2.0
export const isImageFile = file => /\.(jpe?g|png|tiff?)$/i.test(file.name);
export async function decodeSource(file, signal) {
  signal?.throwIfAborted();
  if (!/\.tiff?$/i.test(file.name)) {
    const bitmap=await createImageBitmap(file);
    if (signal?.aborted) { bitmap.close(); signal.throwIfAborted(); }
    return {bitmap,source:null};
  }
  const bytes=await file.arrayBuffer();
  signal?.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./tiff.worker.js',import.meta.url),{type:'module'});
    const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();};
    const abort=()=>{cleanup();reject(new DOMException('TIFF decoding cancelled.','AbortError'));};
    const timer=setTimeout(()=>{cleanup();reject(new Error('TIFF decode exceeded 60 seconds. Use a smaller strip-based image.'));},60000);
    signal?.addEventListener('abort',abort,{once:true});
    worker.onmessage=({data})=>{cleanup(); data.error?reject(new Error(data.error)):resolve(data);};
    worker.onerror=()=>{cleanup();reject(new Error('TIFF decoder worker failed.'));};
    worker.postMessage(bytes,[bytes]);
  });
}
