// SPDX-License-Identifier: Apache-2.0
import { decode, isMultiPage } from 'tiff';

// The app deliberately accepts a narrower, tested subset than the decoder.
export function decodeTiff(bytes) {
  if (isMultiPage(bytes)) throw new Error('Multi-page TIFF is not supported. Save each page as a separate TIFF file.');
  const [header] = decode(bytes, { ignoreImageData: true, pages: [0] });
  if (!header) throw new Error('TIFF contains no image.');
  const { width, height, bitsPerSample: bits, samplesPerPixel: channels } = header;
  if (![width,height].every(Number.isSafeInteger) || width < 1 || height < 1 || width > 32767 || height > 32767 || width*height > 100000000)
    throw new Error('TIFF exceeds the beta canvas limit (32,767 px per side / 100 MP).');
  if (header.get('TileOffsets') !== undefined || header.get('TileWidth') !== undefined)
    throw new Error('Tiled TIFF is not supported. Use strip-based TIFF.');
  if (header.planarConfiguration !== 1) throw new Error('Planar-separated TIFF is not supported. Use interleaved RGB.');
  if (![0,1,2].includes(header.type) || channels !== (header.type === 2 ? 3 : 1) || header.extraSamples?.length)
    throw new Error('TIFF must be grayscale or RGB without alpha (no palette, CMYK or extra channels).');
  const bitValues = [].concat(Array.from(header.get('BitsPerSample')?.length ? header.get('BitsPerSample') : [bits]));
  const formats = header.get('SampleFormat');
  if (![8,16].includes(bits) || bitValues.some(b=>b!==bits) ||
      Array.from(formats?.length ? formats : [formats ?? 1]).some(f=>f!==1))
    throw new Error('Only unsigned 8-bit or 16-bit TIFF samples are supported.');
  if (![1,5,8,32946].includes(header.compression))
    throw new Error('TIFF compression must be uncompressed, LZW or Deflate (PackBits/JPEG/CCITT are not supported).');
  if ((header.orientation ?? 1) !== 1 || header.fillOrder !== 1 || ![1,2].includes(header.predictor))
    throw new Error('TIFF requires top-left orientation, normal fill order and predictor 1 or 2.');
  const strips = Math.ceil(height / header.rowsPerStrip);
  if (header.stripOffsets?.length !== strips || header.stripByteCounts?.length !== strips)
    throw new Error('TIFF strip table is missing or inconsistent.');
  const [image] = decode(bytes, { pages: [0] });
  if (image.data.length !== width*height*channels) throw new Error('Incomplete TIFF pixel data.');
  // Preserve integer samples through decode; produce an explicit 8-bit view.
  // No per-image contrast normalization and no intermediate JPEG encoding.
  const rgba = new Uint8ClampedArray(width*height*4);
  const divisor = bits === 16 ? 257 : 1;
  for (let i=0,j=0; i<width*height; i++,j+=channels) {
    for (let c=0;c<3;c++) rgba[i*4+c]=Math.round(image.data[j+(channels===3?c:0)]/divisor);
    rgba[i*4+3]=255;
  }
  return { width,height,rgba,source: {
    format:'TIFF', decoder:'tiff 7.1.3', bitDepth:bits, channels,
    compression:header.compression, representationBitDepth:8, exportBitDepth:8,
    conversion:bits===16?'Unsigned 16-bit 0–65535 → 8-bit 0–255, round(value / 257)':'Unsigned 8-bit samples',
  }};
}
