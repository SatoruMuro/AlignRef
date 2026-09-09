// SPDX-License-Identifier: Apache-2.0
import {
  identity,
  compose,
  canvasSize,
  finalTransform,
  normalizeCrop,
  validRigid,
} from "./geometry.js";
export function createState(images, dataset = null) {
  const canvas = canvasSize(images);
  return {
    dataset,
    canvas,
    background: "white",
    viewport: { x: 0, y: 0, ...canvas },
    slices: images.map((i) => ({
      name: i.name,
      width: i.width,
      height: i.height,
      source: i.source ?? null,
      automaticTransform: identity(),
      manualTransform: identity(),
      qc: null,
    })),
    cropHistory: [],
  };
}
export function applyRange(state, matrix, start, end) {
  if (
    !validRigid(matrix) ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    Math.min(start, end) < 0 ||
    Math.max(start, end) >= state.slices.length
  )
    throw new Error("Select a valid inclusive slice range.");
  const result = structuredClone(state);
  for (let i = Math.min(start, end); i <= Math.max(start, end); i++)
    result.slices[i].manualTransform = compose(
      matrix,
      result.slices[i].manualTransform,
    );
  return result;
}
export function applyCrop(state, box) {
  const viewport = normalizeCrop(box, state.viewport);
  return {
    ...state,
    viewport,
    cropHistory: [...state.cropHistory, state.viewport],
  };
}
export function undoCrop(state) {
  if (!state.cropHistory.length) throw new Error("No crop to undo.");
  return {
    ...state,
    viewport: state.cropHistory.at(-1),
    cropHistory: state.cropHistory.slice(0, -1),
  };
}
export function expandCanvas(state) {
  const v = state.viewport;
  return {
    ...state,
    viewport: {
      x: v.x - 100,
      y: v.y - 100,
      width: v.width + 200,
      height: v.height + 200,
    },
  };
}
export class History {
  entries = [];
  push(state) {
    this.entries.push(structuredClone(state));
    if (this.entries.length > 50) this.entries.shift();
  }
  undo() {
    if (!this.entries.length) throw new Error("Nothing to undo.");
    return this.entries.pop();
  }
}
export function serialize(state) {
  return {
    dataset: state.dataset,
    app: "AlignRef2",
    version: 1,
    coordinates:
      "center-padded-source-to-reference; canvas [a,b,c,d,e,f]; manual * automatic; clockwise degrees",
    canvas: state.canvas,
    background: state.background,
    viewport: state.viewport,
    slices: state.slices.map((s, index) => ({
      ...s,
      index,
      finalTransform: finalTransform(s),
    })),
  };
}
export function importTransforms(data, state) {
  if (
    data?.app !== "AlignRef2" ||
    data.version !== 1 ||
    data.canvas?.width !== state.canvas.width ||
    data.canvas?.height !== state.canvas.height ||
    !Array.isArray(data.slices) ||
    data.slices.length !== state.slices.length
  )
    throw new Error(
      "Transform file must match the stack count and original canvas dimensions (version 1).",
    );
  if (!["white", "black"].includes(data.background))
    throw new Error("Invalid background.");
  const v = data.viewport;
  if (
    !v ||
    ![v.x, v.y, v.width, v.height].every(Number.isSafeInteger) ||
    v.width < 1 ||
    v.height < 1 ||
    v.width > 32767 ||
    v.height > 32767 ||
    Math.abs(v.x) > 1e7 ||
    Math.abs(v.y) > 1e7
  )
    throw new Error("Invalid output viewport.");
  const slices = state.slices.map((s, i) => {
    const t = data.slices[i];
    if (
      t.index !== i ||
      t.width !== s.width ||
      t.height !== s.height ||
      !validRigid(t.automaticTransform) ||
      !validRigid(t.manualTransform)
    )
      throw new Error(
        `Slice ${i + 1}: dimensions/order or rigid matrix is invalid.`,
      );
    const computed = compose(t.manualTransform, t.automaticTransform);
    if (
      !validRigid(t.finalTransform) ||
      computed.some((v, j) => Math.abs(v - t.finalTransform[j]) > 1e-4)
    )
      throw new Error(`Slice ${i + 1}: inconsistent final transform.`);
    return {
      ...s,
      automaticTransform: [...t.automaticTransform],
      manualTransform: [...t.manualTransform],
      qc: null,
    };
  });
  return {
    ...state,
    slices,
    background: data.background,
    viewport: { ...v },
    cropHistory: [],
  };
}
