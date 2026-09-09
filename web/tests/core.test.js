import { test } from "node:test";
import assert from "node:assert/strict";
import {
  identity,
  rigid,
  compose,
  inverse,
  point,
  naturalSort,
  padding,
  canvasSize,
  finalTransform,
} from "../src/geometry.js";
import {
  createState,
  applyRange,
  applyCrop,
  undoCrop,
  expandCanvas,
  History,
  serialize,
  importTransforms,
} from "../src/model.js";
import {
  registerRigid,
  registrationOrder,
  accumulatePair,
} from "../src/registration.js";
import { exportNames } from "../src/images.js";

const images = [
  { name: "image1.png", width: 256, height: 192 },
  { name: "image2.png", width: 201, height: 181 },
  { name: "image10.png", width: 240, height: 191 },
];
test("natural sort, mixed case and unequal-size center padding without scaling", () => {
  assert.deepEqual(naturalSort(["image10.PNG", "image2.png", "image1.jpg"]), [
    "image1.jpg",
    "image2.png",
    "image10.PNG",
  ]);
  assert.deepEqual(canvasSize(images), { width: 256, height: 192 });
  assert.deepEqual(padding(images[1], canvasSize(images)), { x: 27, y: 5 });
});
test("composition applies automatic then manual; inverse round trip", () => {
  const a = rigid(7, -3, 12, 128, 96),
    m = rigid(-2, 5, -4, 128, 96),
    p = [32, 68];
  const expected = point(m, ...point(a, ...p)),
    actual = point(compose(m, a), ...p);
  assert.ok(
    Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 1e-10,
  );
  const restored = point(inverse(a), ...point(a, ...p));
  assert.ok(Math.hypot(restored[0] - p[0], restored[1] - p[1]) < 1e-10);
});
test("range apply includes reversed endpoints, composes once and undo restores all transforms", () => {
  const s = createState(images),
    h = new History();
  s.slices[1].automaticTransform = rigid(3, 4, 5, 128, 96);
  h.push(s);
  const delta = rigid(4, -2, 3, 128, 96),
    next = applyRange(s, delta, 2, 1);
  assert.deepEqual(next.slices[0].manualTransform, identity());
  assert.deepEqual(next.slices[2].manualTransform, delta);
  assert.deepEqual(
    finalTransform(next.slices[1]),
    compose(delta, s.slices[1].automaticTransform),
  );
  assert.deepEqual(h.undo(), s);
  assert.deepEqual(s.slices[1].manualTransform, identity());
  assert.throws(() => applyRange(s, delta, 0, 3));
});
test("crop is common and reversible, repeated crop and expansion never change source pixels or transforms", () => {
  const s = createState(images),
    c = applyCrop(s, { x: 10, y: 11, width: 100, height: 120 });
  const cc = applyCrop(c, { x: 20, y: 21, width: 50, height: 60 });
  assert.deepEqual(undoCrop(cc).viewport, c.viewport);
  assert.deepEqual(undoCrop(c).viewport, s.viewport);
  assert.deepEqual(c.slices, s.slices);
  const expanded = expandCanvas(c);
  assert.deepEqual(expanded.viewport, {
    x: -90,
    y: -89,
    width: 300,
    height: 320,
  });
  assert.deepEqual(expanded.canvas, s.canvas);
  assert.throws(() => applyCrop(s, { x: 0, y: 0, width: 0, height: 10 }));
});
test("transform JSON round trip maps alternate names by slice order; rejects mismatch and nonrigid input atomically", () => {
  const s = applyCrop(
    applyRange(createState(images), rigid(2, 3, 4, 128, 96), 0, 2),
    { x: 10, y: 10, width: 100, height: 100 },
  );
  const data = serialize(s),
    target = createState(images.map((i) => ({ ...i, name: "blue-" + i.name })));
  const loaded = importTransforms(data, target);
  assert.deepEqual(
    loaded.slices[1].manualTransform,
    s.slices[1].manualTransform,
  );
  assert.equal(loaded.slices[1].name, "blue-image2.png");
  assert.deepEqual(loaded.viewport, s.viewport);
  const bad = structuredClone(data);
  bad.slices[1].automaticTransform[0] = 2;
  assert.throws(() => importTransforms(bad, target));
  const sizes = structuredClone(data);
  sizes.slices[1].width++;
  assert.throws(() => importTransforms(sizes, target));
  const final = structuredClone(data);
  final.slices[0].finalTransform[4]++;
  assert.throws(() => importTransforms(final, target));
  assert.deepEqual(target.slices[0].manualTransform, identity());
});
test("export names preserve order and avoid duplicate basename collisions", () => {
  assert.deepEqual(
    exportNames(
      [
        { name: "image1.jpg" },
        { name: "image1.png" },
        { name: "image1__002.png" },
        { name: "image10.png" },
      ],
      "png",
    ),
    ["image1.png", "image1__002.png", "image1__002__002.png", "image10.png"],
  );
});
test("middle and current reference traversal and proxy translation scaling", () => {
  assert.deepEqual(registrationOrder(7, 3), [
    [2, 3],
    [1, 2],
    [0, 1],
    [4, 3],
    [5, 4],
    [6, 5],
  ]);
  assert.deepEqual(registrationOrder(3, 0), [
    [1, 0],
    [2, 1],
  ]);
  const pair = rigid(2, -3, 8, 64, 48),
    parent = rigid(5, 1, 2, 128, 96);
  assert.deepEqual(
    accumulatePair(parent, pair, 0.5),
    compose(parent, [...pair.slice(0, 4), pair[4] * 2, pair[5] * 2]),
  );
});

// Analytic fixture generation is independent of the registration sampler.
export function texture(x, y) {
  let v = 0.94;
  for (const [cx, cy, sx, sy, amplitude] of [
    [61, 55, 15, 21, 0.6],
    [153, 112, 25, 13, 0.5],
    [103, 136, 12, 10, 0.65],
    [187, 48, 10, 17, 0.6],
    [124, 75, 8, 12, 0.4],
  ])
    v -=
      amplitude *
      Math.exp(
        -((x - cx) ** 2 / (2 * sx * sx) + (y - cy) ** 2 / (2 * sy * sy)),
      );
  return v;
}
function synthetic(transform, width = 256, height = 192) {
  const inv = inverse(transform),
    data = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = point(inv, x + 0.5, y + 0.5);
      data[y * width + x] = texture(...p);
    }
  return { width, height, data };
}
for (const [dx, dy, angle] of [
  [12, -8, 0],
  [0, 0, 8],
  [13, -9, -11],
  [-17, 12, 17],
]) {
  test(`synthetic rigid restoration dx=${dx}, dy=${dy}, rotation=${angle}°`, () => {
    const known = rigid(dx, dy, angle, 128, 96),
      fixed = synthetic(identity()),
      moving = synthetic(known);
    const result = registerRigid(fixed, moving),
      residual = compose(result.matrix, known);
    const errors = [
      [40, 40],
      [190, 40],
      [40, 150],
      [190, 150],
    ].map((p) => {
      const q = point(residual, ...p);
      return Math.hypot(q[0] - p[0], q[1] - p[1]);
    });
    assert.ok(
      Math.max(...errors) < 0.6,
      `residual ${Math.max(...errors)} px; matrix ${result.matrix}`,
    );
    assert.ok(result.score > 0.98, `correlation ${result.score}`);
  });
}
test("textureless input fails explicitly, no successful identity fallback", () => {
  const blank = {
    width: 64,
    height: 64,
    data: new Float32Array(4096).fill(0.5),
  };
  assert.throws(() => registerRigid(blank, blank), /texture/);
});
