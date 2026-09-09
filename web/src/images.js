// SPDX-License-Identifier: Apache-2.0
import { padding, finalTransform, identity, compose } from "./geometry.js";

export function makeCanvas(width, height) {
  if (
    width < 1 ||
    height < 1 ||
    width > 32767 ||
    height > 32767 ||
    width * height > 100000000
  )
    throw new Error(
      "Canvas exceeds the beta limit (32,767 px per side / 100 MP). Use a smaller stack.",
    );
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  if (!c.getContext("2d"))
    throw new Error("Browser could not allocate a canvas.");
  return c;
}
// Keep File objects; only a small LRU of decoded originals is retained.
export class ImageStore {
  cache = new Map();
  constructor(files) {
    this.files = files;
  }
  async get(index) {
    if (this.cache.has(index)) {
      const b = this.cache.get(index);
      this.cache.delete(index);
      this.cache.set(index, b);
      return b;
    }
    const bitmap = await createImageBitmap(this.files[index]);
    this.cache.set(index, bitmap);
    while (this.cache.size > 3) {
      const key = this.cache.keys().next().value;
      this.cache.get(key).close();
      this.cache.delete(key);
    }
    return bitmap;
  }
  close() {
    for (const b of this.cache.values()) b.close();
    this.cache.clear();
  }
}
export function drawSlice(ctx, bitmap, slice, state, extra = identity()) {
  const p = padding(slice, state.canvas),
    m = compose(extra, finalTransform(slice));
  ctx.save();
  ctx.transform(...m);
  ctx.drawImage(bitmap, p.x, p.y);
  ctx.restore();
}
export function renderSlice(bitmap, slice, state) {
  const v = state.viewport,
    c = makeCanvas(v.width, v.height),
    ctx = c.getContext("2d");
  ctx.fillStyle = state.background;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(-v.x, -v.y);
  drawSlice(ctx, bitmap, slice, state);
  return c;
}
export async function encodeCanvas(canvas, format, quality = 0.95) {
  const mime = format === "jpeg" ? "image/jpeg" : "image/png";
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, mime, quality),
  );
  if (!blob || blob.type !== mime)
    throw new Error("Browser image encoding failed. Try a smaller canvas.");
  return blob;
}
export function makeProxy(bitmap, slice, state, limit, channel) {
  const scale = Math.min(
    1,
    limit / Math.max(state.canvas.width, state.canvas.height),
  );
  const width = Math.ceil(state.canvas.width * scale),
    height = Math.ceil(state.canvas.height * scale);
  const c = makeCanvas(width, height),
    ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = state.background;
  ctx.fillRect(0, 0, width, height);
  ctx.scale(scale, scale);
  const p = padding(slice, state.canvas);
  ctx.drawImage(bitmap, p.x, p.y);
  const rgba = ctx.getImageData(0, 0, width, height).data,
    data = new Float32Array(width * height),
    mask = new Uint8Array(width * height);
  const channelIndex = { Red: 0, Green: 1, Blue: 2 }[channel];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x,
        k = i * 4;
      data[i] =
        (channel === "Gray"
          ? 0.2126 * rgba[k] + 0.7152 * rgba[k + 1] + 0.0722 * rgba[k + 2]
          : rgba[k + channelIndex]) / 255;
      mask[i] =
        (x + 0.5) / scale >= p.x + 1 &&
        (x + 0.5) / scale < p.x + slice.width - 1 &&
        (y + 0.5) / scale >= p.y + 1 &&
        (y + 0.5) / scale < p.y + slice.height - 1
          ? 1
          : 0;
    }
  c.width = c.height = 1;
  return { width, height, data, mask, scale };
}
export function exportNames(slices, format) {
  const used = new Set(),
    ext = format === "jpeg" ? "jpg" : "png";
  return slices.map((s, i) => {
    const stem =
      s.name
        .replace(/\.[^.]+$/, "")
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
        .replace(/[. ]+$/, "") || `image${i + 1}`;
    let name = `${stem}.${ext}`,
      suffix = 1;
    while (used.has(name.toLowerCase()))
      name = `${stem}__${String(++suffix).padStart(3, "0")}.${ext}`;
    used.add(name.toLowerCase());
    return name;
  });
}
