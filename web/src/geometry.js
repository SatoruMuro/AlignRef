// SPDX-License-Identifier: Apache-2.0
// Canvas convention: [a,b,c,d,e,f], x'=a*x+c*y+e, y'=b*x+d*y+f.
export const identity = () => [1, 0, 0, 1, 0, 0];
export const translate = (x, y) => [1, 0, 0, 1, x, y];
export function compose(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
export function rigid(dx, dy, degrees, cx = 0, cy = 0) {
  const t = (degrees * Math.PI) / 180,
    c = Math.cos(t),
    s = Math.sin(t);
  return [c, s, -s, c, cx + dx - c * cx + s * cy, cy + dy - s * cx - c * cy];
}
export function inverse(m) {
  const det = m[0] * m[3] - m[1] * m[2];
  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}
export const point = (m, x, y) => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];
export const finalTransform = (slice) =>
  compose(slice.manualTransform, slice.automaticTransform);
export const naturalSort = (files) =>
  [...files].sort(
    (a, b) =>
      (a.name ?? a).localeCompare(b.name ?? b, "en", {
        numeric: true,
        sensitivity: "base",
      }) ||
      (a.webkitRelativePath ?? a.name ?? a).localeCompare(
        b.webkitRelativePath ?? b.name ?? b,
        "en",
      ),
  );
export function canvasSize(images) {
  return images.reduce(
    (s, i) => ({
      width: Math.max(s.width, i.width),
      height: Math.max(s.height, i.height),
    }),
    { width: 0, height: 0 },
  );
}
export const padding = (image, canvas) => ({
  x: Math.floor((canvas.width - image.width) / 2),
  y: Math.floor((canvas.height - image.height) / 2),
});
export function normalizeCrop(box, bounds) {
  if (![box.x, box.y, box.width, box.height].every(Number.isFinite))
    throw new Error("Crop coordinates must be finite numbers.");
  const x = Math.max(
    bounds.x,
    Math.min(
      bounds.x + bounds.width,
      Math.round(Math.min(box.x, box.x + box.width)),
    ),
  );
  const y = Math.max(
    bounds.y,
    Math.min(
      bounds.y + bounds.height,
      Math.round(Math.min(box.y, box.y + box.height)),
    ),
  );
  const right = Math.max(
    x,
    Math.min(
      bounds.x + bounds.width,
      Math.round(Math.max(box.x, box.x + box.width)),
    ),
  );
  const bottom = Math.max(
    y,
    Math.min(
      bounds.y + bounds.height,
      Math.round(Math.max(box.y, box.y + box.height)),
    ),
  );
  if (right - x < 1 || bottom - y < 1)
    throw new Error("Crop must contain at least one pixel.");
  return { x, y, width: right - x, height: bottom - y };
}
export function validRigid(m) {
  return (
    Array.isArray(m) &&
    m.length === 6 &&
    m.every(Number.isFinite) &&
    Math.abs(m[0] * m[0] + m[1] * m[1] - 1) < 1e-5 &&
    Math.abs(m[2] + m[1]) < 1e-5 &&
    Math.abs(m[3] - m[0]) < 1e-5 &&
    Math.abs(m[4]) < 1e8 &&
    Math.abs(m[5]) < 1e8
  );
}
