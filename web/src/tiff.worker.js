// SPDX-License-Identifier: Apache-2.0
import { decodeTiff } from './tiff.js';
self.onmessage = async ({data}) => {
  try {
    const decoded=decodeTiff(data);
    const bitmap=await createImageBitmap(new ImageData(decoded.rgba,decoded.width,decoded.height));
    self.postMessage({bitmap,source:decoded.source},[bitmap]);
  } catch (error) { self.postMessage({error:error.message}); }
};
