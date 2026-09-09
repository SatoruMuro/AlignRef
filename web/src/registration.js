// SPDX-License-Identifier: Apache-2.0
// Original multiresolution rigid normalized cross-correlation implementation.
// No MultiStackReg, TurboReg, or OpenCV code is used.
import { rigid, inverse, identity, compose } from "./geometry.js";

export function sample(image, x, y) {
  if (x < 0 || y < 0 || x >= image.width - 1 || y >= image.height - 1)
    return NaN;
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy,
    k = iy * image.width + ix,
    d = image.data;
  return (
    (d[k] * (1 - fx) + d[k + 1] * fx) * (1 - fy) +
    (d[k + image.width] * (1 - fx) + d[k + image.width + 1] * fx) * fy
  );
}
function half(image) {
  const width = Math.ceil(image.width / 2),
    height = Math.ceil(image.height / 2),
    data = new Float32Array(width * height),
    mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0,
        n = 0,
        valid = 0;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const xx = x * 2 + dx,
            yy = y * 2 + dy;
          if (xx < image.width && yy < image.height) {
            const k = yy * image.width + xx;
            sum += image.data[k];
            valid += image.mask?.[k] ?? 1;
            n++;
          }
        }
      data[y * width + x] = sum / n;
      mask[y * width + x] = valid === n ? 1 : 0;
    }
  return { width, height, data, mask };
}
function centroid(image) {
  // Contrast relative to border median avoids fixing the synthetic padding frame.
  const border = [];
  for (let x = 0; x < image.width; x++) {
    border.push(
      image.data[x],
      image.data[(image.height - 1) * image.width + x],
    );
  }
  border.sort((a, b) => a - b);
  const bg = border[Math.floor(border.length / 2)];
  let sx = 0,
    sy = 0,
    total = 0;
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const k = y * image.width + x,
        w = Math.abs(image.data[k] - bg) * (image.mask?.[k] ?? 1);
      sx += (x + 0.5) * w;
      sy += (y + 0.5) * w;
      total += w;
    }
  return total > 1e-5
    ? [sx / total, sy / total]
    : [image.width / 2, image.height / 2];
}
export function correlation(fixed, moving, matrix, maxSamples = 14000) {
  const inv = inverse(matrix),
    stride = Math.max(
      1,
      Math.floor(Math.sqrt((fixed.width * fixed.height) / maxSamples)),
    );
  let n = 0,
    eligible = 0,
    sf = 0,
    sm = 0,
    sff = 0,
    smm = 0,
    sfm = 0;
  for (let y = 1; y < fixed.height - 1; y += stride)
    for (let x = 1; x < fixed.width - 1; x += stride) {
      const k = y * fixed.width + x;
      if (fixed.mask && !fixed.mask[k]) continue;
      eligible++;
      const mx = inv[0] * (x + 0.5) + inv[2] * (y + 0.5) + inv[4] - 0.5;
      const my = inv[1] * (x + 0.5) + inv[3] * (y + 0.5) + inv[5] - 0.5;
      const m = sample(moving, mx, my);
      if (!Number.isFinite(m)) continue;
      const ix = Math.floor(mx),
        iy = Math.floor(my),
        mk = iy * moving.width + ix;
      if (
        moving.mask &&
        (!moving.mask[mk] ||
          !moving.mask[mk + 1] ||
          !moving.mask[mk + moving.width] ||
          !moving.mask[mk + moving.width + 1])
      )
        continue;
      const f = fixed.data[k];
      n++;
      sf += f;
      sm += m;
      sff += f * f;
      smm += m * m;
      sfm += f * m;
    }
  if (n < 32 || n < eligible * 0.45) return -1;
  const vf = sff - (sf * sf) / n,
    vm = smm - (sm * sm) / n;
  if (vf / n < 1e-7 || vm / n < 1e-7) return -1;
  return (sfm - (sf * sm) / n) / Math.sqrt(vf * vm);
}
function optimize(fixed, moving, p, steps, maxIterations = 35) {
  const score = (q) =>
    correlation(
      fixed,
      moving,
      rigid(q[0], q[1], q[2], fixed.width / 2, fixed.height / 2),
    );
  let best = score(p);
  for (const [translation, angle] of steps) {
    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = false;
      for (let axis = 0; axis < 3; axis++) {
        let candidate = p,
          value = best;
        for (const sign of [-1, 1]) {
          const q = [...p];
          q[axis] += sign * (axis === 2 ? angle : translation);
          if (
            Math.abs(q[2]) > 40 ||
            Math.abs(q[0]) > fixed.width * 0.4 ||
            Math.abs(q[1]) > fixed.height * 0.4
          )
            continue;
          const v = score(q);
          if (v > value + 1e-9) {
            candidate = q;
            value = v;
          }
        }
        if (candidate !== p) {
          p = candidate;
          best = value;
          changed = true;
        }
      }
      if (!changed) break;
    }
  }
  return { p, score: best };
}
export function registerRigid(fixed, moving) {
  if (fixed.width !== moving.width || fixed.height !== moving.height)
    throw new Error("Proxy dimensions must match.");
  if (Math.min(fixed.width, fixed.height) < 16)
    throw new Error("Registration needs images at least 16 pixels across.");
  const fp = [fixed],
    mp = [moving];
  while (
    Math.max(fp.at(-1).width, fp.at(-1).height) > 80 &&
    Math.min(fp.at(-1).width, fp.at(-1).height) > 32
  ) {
    fp.push(half(fp.at(-1)));
    mp.push(half(mp.at(-1)));
  }
  const f = fp.at(-1),
    m = mp.at(-1),
    fc = centroid(f),
    mc = centroid(m),
    cx = f.width / 2,
    cy = f.height / 2;
  const seeds = [{ p: [0, 0, 0], score: correlation(f, m, identity()) }];
  for (let angle = -30; angle <= 30; angle += 5) {
    const r = (angle * Math.PI) / 180,
      c = Math.cos(r),
      s = Math.sin(r);
    const dx = fc[0] - (c * (mc[0] - cx) - s * (mc[1] - cy) + cx),
      dy = fc[1] - (s * (mc[0] - cx) + c * (mc[1] - cy) + cy);
    for (const ox of [-6, 0, 6])
      for (const oy of [-6, 0, 6]) {
        const p = [dx + ox, dy + oy, angle];
        seeds.push({ p, score: correlation(f, m, rigid(...p, cx, cy)) });
      }
  }
  seeds.sort((a, b) => b.score - a.score);
  let best = seeds
    .slice(0, 4)
    .map((s) =>
      optimize(f, m, s.p, [
        [2, 2],
        [1, 1],
        [0.5, 0.5],
        [0.25, 0.2],
      ]),
    )
    .sort((a, b) => b.score - a.score)[0];
  // Convert through affine translation to account for odd pyramid dimensions.
  for (let level = fp.length - 2; level >= 0; level--) {
    const previous = fp[level + 1],
      next = fp[level];
    const matrix = rigid(...best.p, previous.width / 2, previous.height / 2);
    const a = (best.p[2] * Math.PI) / 180,
      c = Math.cos(a),
      s = Math.sin(a),
      nx = next.width / 2,
      ny = next.height / 2;
    const p = [
      matrix[4] * 2 - nx + c * nx - s * ny,
      matrix[5] * 2 - ny + s * nx + c * ny,
      best.p[2],
    ];
    best = optimize(next, mp[level], p, [
      [1, 0.5],
      [0.5, 0.2],
      [0.25, 0.08],
      [0.125, 0.025],
    ]);
  }
  const matrix = rigid(...best.p, fixed.width / 2, fixed.height / 2);
  if (best.score < 0.35)
    throw Object.assign(new Error(
      "Insufficient image similarity or texture. Choose another channel or align manually.",
    ), { estimatedTransform: matrix, score: best.score });
  return {
    matrix,
    score: best.score,
    warning: best.score < 0.7 ? "Low correlation — inspect overlay." : null,
  };
}
export function registrationOrder(count, reference) {
  const pairs = [];
  for (let i = reference - 1; i >= 0; i--) pairs.push([i, i + 1]);
  for (let i = reference + 1; i < count; i++) pairs.push([i, i - 1]);
  return pairs;
}
export function accumulatePair(parent, pair, proxyScale) {
  const full = [...pair];
  full[4] /= proxyScale;
  full[5] /= proxyScale;
  return compose(parent, full);
}
