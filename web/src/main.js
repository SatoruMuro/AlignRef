// SPDX-License-Identifier: Apache-2.0
import "./style.css";
import { zip, strToU8 } from "fflate";
import {
  naturalSort,
  identity,
  rigid,
  finalTransform,
  normalizeCrop,
} from "./geometry.js";
import {
  createState,
  applyRange,
  applyCrop,
  undoCrop,
  expandCanvas,
  History,
  serialize,
  importTransforms,
} from "./model.js";
import {
  ImageStore,
  drawSlice,
  renderSlice,
  encodeCanvas,
  makeProxy,
  exportNames,
  makeCanvas,
} from "./images.js";
import { registrationOrder, accumulatePair } from "./registration.js";

const $ = (id) => document.getElementById(id),
  viewer = $("viewer"),
  canvas = $("canvas");
let state = null,
  store = null,
  current = 0,
  history = new History(),
  busy = false,
  cancelled = false;
let recording = null,
  recorded = null,
  start = null,
  end = null,
  overlay = 0,
  cropBox = null,
  cropMode = false;
let scale = 1,
  pan = { x: 0, y: 0 },
  autoFit = true,
  drag = null,
  worker = null,
  rejectWorker = null;
let drawing = false,
  needsDraw = false,
  epoch = 0;
const message = (text, error = false) => {
  $("status").textContent = text;
  $("status").classList.toggle("error", error);
};
const pause = () => new Promise((r) => setTimeout(r, 0));
const checkCancel = () => {
  if (cancelled) throw new DOMException("Operation cancelled.", "AbortError");
};
function update() {
  const loaded = !!state,
    n = state?.slices.length ?? 0,
    locked = busy || !!recording;
  document.body.classList.toggle("busy", busy);
  document
    .querySelectorAll("[data-stack]")
    .forEach((e) => (e.disabled = !loaded || busy));
  for (const id of [
    "load",
    "folder",
    "background",
    "channel",
    "proxy",
    "reference",
    "format",
    "quality",
    "transform-file",
  ])
    $(id).disabled = locked;
  $("slice").disabled = !loaded || locked;
  for (const id of [
    "register",
    "expand",
    "record",
    "range-start",
    "range-end",
    "apply-range",
    "undo",
    "start-crop",
    "apply-crop",
    "undo-crop",
    "export-folder",
    "export-zip",
    "export-transforms",
    "import-transforms",
  ])
    $(id).disabled = !loaded || locked;
  $("finish").disabled = $("cancel-record").disabled = !recording || busy;
  $("apply-range").disabled ||= !recorded || start === null || end === null;
  $("undo").disabled ||= !history.entries.length;
  $("apply-crop").disabled ||= !cropBox;
  $("undo-crop").disabled ||= !state?.cropHistory.length;
  $("register").disabled ||= n < 2;
  $("prev").disabled = !loaded || locked || current === 0;
  $("next").disabled = !loaded || locked || current === n - 1;
  $("overlay-prev").disabled = !loaded || busy || current === 0;
  $("overlay-next").disabled = !loaded || busy || current === n - 1;
  $("export-folder").disabled ||= !window.showDirectoryPicker;
  $("export-folder").title = window.showDirectoryPicker
    ? "Saves sequentially into a new subfolder."
    : "Folder export is available in Chrome / Edge. Use ZIP here.";
  for (const id of ["crop-x", "crop-y", "crop-width", "crop-height"])
    $(id).disabled = !loaded || locked;
  $("cancel-job").hidden = !busy;
  $("empty").hidden = loaded;
  canvas.hidden = !loaded;
  $("count").textContent = `/ ${n}`;
  $("slice").value = current + 1;
  $("slice").max = n;
  $("range").textContent =
    `Range: ${start === null ? "—" : start + 1} → ${end === null ? "—" : end + 1} (inclusive)`;
  const r = recording ?? recorded;
  $("recorded").textContent = r
    ? `${recording ? "Recording" : "Stored"}: ΔX ${r.dx.toFixed(1)} px · ΔY ${r.dy.toFixed(1)} px · Δθ ${r.angle.toFixed(2)}°`
    : "No correction recorded";
  viewer.classList.toggle("recording", !!recording);
  viewer.style.cursor = cropMode ? "crosshair" : "grab";
  if (loaded) {
    const s = state.slices[current],
      v = state.viewport,
      m = finalTransform(s);
    $("filename").textContent = s.name;
    $("dimensions").textContent = `${v.width} × ${v.height} px`;
    $("stack-info").textContent =
      `${n} images · original canvas ${state.canvas.width} × ${state.canvas.height} px`;
    $("transform-info").textContent =
      `Final: X ${m[4].toFixed(2)} · Y ${m[5].toFixed(2)} px · θ ${((Math.atan2(m[1], m[0]) * 180) / Math.PI).toFixed(3)}°`;
    $("qc").textContent =
      s.qc === null
        ? "QC: not registered"
        : s.qc.reference
          ? "QC: reference"
          : `QC correlation: ${s.qc.score.toFixed(3)}${s.qc.warning ? " · inspect" : ""}`;
    $("background").value = state.background;
  }
}
function commit(next, text) {
  history.push(state);
  state = next;
  epoch++;
  update();
  requestDraw();
  if (text) message(text);
}
function fit() {
  autoFit = true;
  pan = { x: 0, y: 0 };
  requestDraw();
}
function viewGeometry() {
  const rect = { width: viewer.clientWidth, height: viewer.clientHeight },
    v = state.viewport;
  if (autoFit)
    scale = Math.min(
      (rect.width - 30) / v.width,
      (rect.height - 30) / v.height,
    );
  return {
    width: rect.width,
    height: rect.height,
    ox: (rect.width - v.width * scale) / 2 + pan.x,
    oy: (rect.height - v.height * scale) / 2 + pan.y,
  };
}
function requestDraw() {
  needsDraw = true;
  if (!drawing) void draw();
}
async function draw() {
  drawing = true;
  try {
    while (needsDraw) {
      needsDraw = false;
      if (!state) continue;
      const version = epoch,
        source = store,
        snapshot = state,
        index = current;
      const bitmap = await source.get(index);
      if (version !== epoch || source !== store) {
        needsDraw = true;
        continue;
      }
      const g = viewGeometry(),
        dpr = Math.min(devicePixelRatio || 1, 2),
        v = snapshot.viewport;
      canvas.width = Math.round(g.width * dpr);
      canvas.height = Math.round(g.height * dpr);
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#0c1118";
      ctx.fillRect(0, 0, g.width, g.height);
      ctx.translate(g.ox, g.oy);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.rect(0, 0, v.width, v.height);
      ctx.clip();
      ctx.fillStyle = snapshot.background;
      ctx.fillRect(0, 0, v.width, v.height);
      ctx.translate(-v.x, -v.y);
      const extra = recording
        ? rigid(
            recording.dx,
            recording.dy,
            recording.angle,
            v.x + v.width / 2,
            v.y + v.height / 2,
          )
        : identity();
      drawSlice(ctx, bitmap, snapshot.slices[index], snapshot, extra);
      const other = index + overlay;
      if (overlay && other >= 0 && other < snapshot.slices.length) {
        const neighbor = await source.get(other);
        if (version !== epoch || source !== store) {
          needsDraw = true;
          continue;
        }
        ctx.globalAlpha = $("flicker").checked
          ? Math.floor(Date.now() / 500) % 2
          : Number($("opacity").value);
        ctx.fillStyle = snapshot.background;
        ctx.fillRect(v.x, v.y, v.width, v.height);
        drawSlice(ctx, neighbor, snapshot.slices[other], snapshot);
        ctx.globalAlpha = 1;
      }
      if (cropBox) {
        ctx.strokeStyle = "#ff755f";
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([7 / scale, 4 / scale]);
        ctx.strokeRect(cropBox.x, cropBox.y, cropBox.width, cropBox.height);
        ctx.setLineDash([]);
        ctx.fillStyle = "#fff";
        for (const [x, y] of corners(cropBox)) {
          ctx.fillRect(x - 4 / scale, y - 4 / scale, 8 / scale, 8 / scale);
          ctx.strokeRect(x - 4 / scale, y - 4 / scale, 8 / scale, 8 / scale);
        }
      }
      $("zoom").textContent = `${Math.round(scale * 100)}%`;
    }
  } catch (error) {
    message(`Viewer: ${error.message}`, true);
  } finally {
    drawing = false;
  }
}
async function operation(action) {
  if (busy) return;
  busy = true;
  cancelled = false;
  update();
  try {
    await action();
  } catch (error) {
    message(
      error.name === "AbortError"
        ? "Operation cancelled. Completed folder files, if any, remain saved."
        : error.message,
      error.name !== "AbortError",
    );
  } finally {
    worker?.terminate();
    worker = null;
    rejectWorker = null;
    busy = false;
    update();
    requestDraw();
  }
}
$("cancel-job").onclick = () => {
  cancelled = true;
  worker?.terminate();
  rejectWorker?.(new DOMException("Cancelled", "AbortError"));
};
function on(id, action) {
  $(id).onclick = () => {
    try {
      action();
    } catch (e) {
      message(e.message, true);
    }
  };
}
on("load", () => $("files").click());
on("folder", () => $("folders").click());
async function loadFiles(input) {
  const files = naturalSort(
    [...input].filter((f) => /\.(jpe?g|png)$/i.test(f.name)),
  );
  if (!files.length) {
    message("Choose JPG, JPEG or PNG images.", true);
    return;
  }
  await operation(async () => {
    const images = [];
    for (let i = 0; i < files.length; i++) {
      checkCancel();
      message(
        `Reading dimensions ${i + 1} / ${files.length}: ${files[i].name}`,
      );
      let bitmap;
      try {
        bitmap = await createImageBitmap(files[i]);
        images.push({
          name: files[i].name,
          width: bitmap.width,
          height: bitmap.height,
        });
      } catch {
        throw new Error(`Cannot decode ${files[i].name}. Stack unchanged.`);
      } finally {
        bitmap?.close();
      }
      await pause();
    }
    checkCancel();
    const next = createState(images);
    next.background = $("background").value;
    const test = makeCanvas(next.canvas.width, next.canvas.height);
    test.width = test.height = 1;
    epoch++;
    store?.close();
    store = new ImageStore(files);
    state = next;
    current = Math.floor(files.length / 2);
    history = new History();
    recording = recorded = null;
    start = end = null;
    overlay = 0;
    cropBox = null;
    cropMode = false;
    syncCrop();
    fit();
    message(
      `Loaded ${files.length} images. Originals preserved; ready for registration.`,
    );
  });
}
for (const id of ["files", "folders"])
  $(id).onchange = async (e) => {
    await loadFiles(e.target.files);
    e.target.value = "";
  };
$("background").onchange = () => {
  if (state)
    commit(
      { ...state, background: $("background").value },
      "Canvas background updated.",
    );
};
on("expand", () => {
  const next = expandCanvas(state);
  const c = makeCanvas(next.viewport.width, next.viewport.height);
  c.width = c.height = 1;
  commit(next, "Added 100 px padding on every side.");
  cropBox = null;
  syncCrop();
  fit();
});
function navigate(index) {
  if (!state || busy || recording) return;
  current = Math.max(0, Math.min(state.slices.length - 1, index));
  epoch++;
  update();
  requestDraw();
}
on("prev", () => navigate(current - 1));
on("next", () => navigate(current + 1));
$("slice").onchange = () => navigate((Number($("slice").value) || 1) - 1);
on("fit", fit);
function zoom(factor) {
  if (!state) return;
  autoFit = false;
  scale = Math.max(0.01, Math.min(20, scale * factor));
  requestDraw();
}
on("zoom-in", () => zoom(1.25));
on("zoom-out", () => zoom(0.8));
viewer.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.25 : 0.8);
    }
  },
  { passive: false },
);
new ResizeObserver(() => requestDraw()).observe(viewer);
on("overlay-prev", () => {
  overlay = -1;
  requestDraw();
});
on("overlay-next", () => {
  overlay = 1;
  requestDraw();
});
on("clear-overlay", () => {
  overlay = 0;
  $("flicker").checked = false;
  requestDraw();
});
$("opacity").oninput = requestDraw;
$("flicker").onchange = requestDraw;
setInterval(() => {
  if ($("flicker").checked && overlay && !busy) requestDraw();
}, 250);

function runPair(fixed, moving) {
  return new Promise((resolve, reject) => {
    rejectWorker = reject;
    worker = new Worker(new URL("./registration.worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      worker = null;
      rejectWorker = null;
      data.error ? reject(new Error(data.error)) : resolve(data.result);
    };
    worker.onerror = (e) => {
      worker.terminate();
      worker = null;
      rejectWorker = null;
      reject(new Error(`Registration worker failed: ${e.message}`));
    };
    worker.postMessage({ fixed, moving }, [
      fixed.data.buffer,
      fixed.mask.buffer,
      moving.data.buffer,
      moving.mask.buffer,
    ]);
  });
}
on(
  "register",
  () =>
    void operation(async () => {
      const reference =
        $("reference").value === "middle"
          ? Math.floor(state.slices.length / 2)
          : current;
      const next = structuredClone(state),
        limit = Number($("proxy").value),
        channel = $("channel").value;
      next.slices.forEach((s) => {
        s.automaticTransform = identity();
        s.qc = null;
      });
      next.slices[reference].qc = { reference: true };
      const pairs = registrationOrder(next.slices.length, reference);
      for (let k = 0; k < pairs.length; k++) {
        checkCancel();
        const [i, parent] = pairs[k];
        message(
          `Registering ${k + 1} / ${pairs.length}: slice ${i + 1} → ${parent + 1} (${channel})`,
        );
        const fixed = makeProxy(
          await store.get(parent),
          state.slices[parent],
          state,
          limit,
          channel,
        );
        const moving = makeProxy(
            await store.get(i),
            state.slices[i],
            state,
            limit,
            channel,
          ),
          proxyScale = fixed.scale;
        let result;
        try {
          result = await runPair(fixed, moving);
        } catch (e) {
          if (e.name === "AbortError") throw e;
          throw new Error(
            `Slice ${i + 1} → ${parent + 1}: ${e.message} No automatic transforms were changed.`,
          );
        }
        next.slices[i].automaticTransform = accumulatePair(
          next.slices[parent].automaticTransform,
          result.matrix,
          proxyScale,
        );
        next.slices[i].qc = {
          score: result.score,
          warning: result.warning,
          parent,
          channel,
          proxy: limit,
        };
        await pause();
      }
      checkCancel();
      commit(next);
      current = reference;
      const weak = next.slices.filter((s) => s.qc?.warning).length;
      $("registration-status").textContent =
        `Registered ${next.slices.length} slices · reference ${reference + 1}${weak ? ` · ${weak} low-correlation pairs` : ""}`;
      message(
        `Rigid registration complete. ${weak ? `${weak} pairs need close inspection. ` : ""}Review previous / next overlays. Existing manual corrections preserved.`,
      );
    }),
);

on("record", () => {
  recording = { dx: 0, dy: 0, angle: 0 };
  cropMode = false;
  update();
  message("Recording preview. WASD / arrows: 1 px; QE: 0.1°. Shift ×10.");
  viewer.focus();
});
on("finish", () => {
  const v = state.viewport;
  recorded = {
    ...recording,
    matrix: rigid(
      recording.dx,
      recording.dy,
      recording.angle,
      v.x + v.width / 2,
      v.y + v.height / 2,
    ),
  };
  recording = null;
  start = end = current;
  update();
  requestDraw();
  message(
    "Correction stored; preview removed. Set the range, then Apply Position & Rotation.",
  );
});
on("cancel-record", () => {
  recording = null;
  update();
  requestDraw();
  message("Recording cancelled; image transforms unchanged.");
});
on("range-start", () => {
  start = current;
  update();
});
on("range-end", () => {
  end = current;
  update();
});
on("apply-range", () => {
  commit(
    applyRange(state, recorded.matrix, start, end),
    `Applied correction once to slices ${Math.min(start, end) + 1}–${Math.max(start, end) + 1}.`,
  );
});
function undo() {
  state = history.undo();
  epoch++;
  cropBox = null;
  syncCrop();
  update();
  fit();
  message("Last change undone.");
}
on("undo", undo);
document.addEventListener("keydown", (e) => {
  if (
    /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) ||
    e.target.isContentEditable ||
    !state ||
    busy
  )
    return;
  const key = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && key === "z") {
    e.preventDefault();
    if (!recording) {
      try {
        undo();
      } catch (error) {
        message(error.message);
      }
    }
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (recording) {
    const step = e.shiftKey ? 10 : 1;
    const moves = {
      w: [0, -1],
      o: [0, -1],
      arrowup: [0, -1],
      s: [0, 1],
      l: [0, 1],
      arrowdown: [0, 1],
      a: [-1, 0],
      k: [-1, 0],
      arrowleft: [-1, 0],
      d: [1, 0],
      ";": [1, 0],
      arrowright: [1, 0],
    };
    if (moves[key]) {
      e.preventDefault();
      recording.dx += moves[key][0] * step;
      recording.dy += moves[key][1] * step;
    } else if (["q", "i", "e", "p"].includes(key)) {
      e.preventDefault();
      recording.angle += (["q", "i"].includes(key) ? -1 : 1) * 0.1 * step;
    } else return;
    update();
    requestDraw();
  } else if (["arrowright", "f", "j", "pagedown"].includes(key)) {
    e.preventDefault();
    navigate(current + 1);
  } else if (["arrowleft", "r", "u", "pageup"].includes(key)) {
    e.preventDefault();
    navigate(current - 1);
  }
});

const corners = (b) => [
  [b.x, b.y],
  [b.x + b.width, b.y],
  [b.x, b.y + b.height],
  [b.x + b.width, b.y + b.height],
];
function syncCrop() {
  for (const key of ["x", "y", "width", "height"])
    $("crop-" + key).value = cropBox?.[key] ?? "";
}
on("start-crop", () => {
  cropMode = true;
  cropBox = null;
  syncCrop();
  update();
  requestDraw();
  message("Drag a common crop rectangle on the image.");
});
on("clear-crop", () => {
  cropBox = null;
  cropMode = false;
  syncCrop();
  update();
  requestDraw();
});
on("apply-crop", () => {
  commit(applyCrop(state, cropBox), "Common ROI applied to every slice.");
  cropBox = null;
  cropMode = false;
  syncCrop();
  update();
  fit();
});
on("undo-crop", () => {
  commit(undoCrop(state), "Previous crop restored.");
  cropBox = null;
  syncCrop();
  fit();
});
for (const key of ["x", "y", "width", "height"])
  $("crop-" + key).onchange = () => {
    try {
      const b = Object.fromEntries(
        ["x", "y", "width", "height"].map((k) => [
          k,
          Number($("crop-" + k).value),
        ]),
      );
      cropBox = normalizeCrop(b, state.viewport);
      cropMode = true;
      syncCrop();
      update();
      requestDraw();
    } catch (e) {
      message(e.message, true);
    }
  };
function eventPoint(e) {
  const r = viewer.getBoundingClientRect(),
    g = viewGeometry();
  return {
    x:
      (e.clientX - r.left - viewer.clientLeft - g.ox) / scale +
      state.viewport.x,
    y: (e.clientY - r.top - viewer.clientTop - g.oy) / scale + state.viewport.y,
  };
}
viewer.onpointerdown = (e) => {
  if (!state || busy || e.button !== 0) return;
  viewer.focus();
  viewer.setPointerCapture(e.pointerId);
  const p = eventPoint(e);
  if (cropMode && !recording) {
    const corner = cropBox
      ? corners(cropBox).findIndex(
          ([x, y]) => Math.hypot(x - p.x, y - p.y) < 12 / scale,
        )
      : -1;
    if (corner >= 0) {
      const opposite = corners(cropBox)[3 - corner];
      drag = { type: "resize", anchor: { x: opposite[0], y: opposite[1] } };
    } else if (
      cropBox &&
      p.x > cropBox.x &&
      p.x < cropBox.x + cropBox.width &&
      p.y > cropBox.y &&
      p.y < cropBox.y + cropBox.height
    )
      drag = { type: "move", p, box: { ...cropBox } };
    else drag = { type: "resize", anchor: p };
  } else drag = { type: "pan", x: e.clientX, y: e.clientY, pan: { ...pan } };
};
viewer.onpointermove = (e) => {
  if (!drag || !state) return;
  if (drag.type === "pan") {
    pan = {
      x: drag.pan.x + e.clientX - drag.x,
      y: drag.pan.y + e.clientY - drag.y,
    };
    autoFit = false;
  } else {
    const p = eventPoint(e),
      v = state.viewport;
    try {
      if (drag.type === "move")
        cropBox = {
          ...drag.box,
          x: Math.round(
            Math.max(
              v.x,
              Math.min(
                v.x + v.width - drag.box.width,
                drag.box.x + p.x - drag.p.x,
              ),
            ),
          ),
          y: Math.round(
            Math.max(
              v.y,
              Math.min(
                v.y + v.height - drag.box.height,
                drag.box.y + p.y - drag.p.y,
              ),
            ),
          ),
        };
      else
        cropBox = normalizeCrop(
          {
            x: drag.anchor.x,
            y: drag.anchor.y,
            width: p.x - drag.anchor.x,
            height: p.y - drag.anchor.y,
          },
          v,
        );
      syncCrop();
      update();
    } catch {
      /* Ignore subpixel drag until it forms a nonempty rectangle. */
    }
  }
  requestDraw();
};
viewer.onpointerup = viewer.onpointercancel = () => {
  drag = null;
};

function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
on("export-transforms", () => {
  download(
    new Blob([JSON.stringify(serialize(state), null, 2)], {
      type: "application/json",
    }),
    "transforms.json",
  );
  message("Transform file downloaded.");
});
on("import-transforms", () => $("transform-file").click());
$("transform-file").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  await operation(async () => {
    if (file.size > 20 * 1024 * 1024)
      throw new Error("Transform file is too large.");
    const data = JSON.parse(await file.text());
    checkCancel();
    commit(
      importTransforms(data, state),
      "Transforms loaded by natural slice order.",
    );
    recorded = null;
    start = end = null;
    cropBox = null;
    syncCrop();
    fit();
  });
};
async function exportImages(directory = null) {
  const format = $("format").value,
    quality = Number($("quality").value),
    names = exportNames(state.slices, format);
  if (!Number.isFinite(quality) || quality < 0.1 || quality > 1)
    throw new Error("JPEG quality must be between 0.1 and 1.");
  const files = Object.create(null);
  let total = 0;
  const manifest = { ...serialize(state), exportFiles: names };
  for (let i = 0; i < state.slices.length; i++) {
    checkCancel();
    message(`Exporting ${i + 1} / ${state.slices.length}: ${names[i]}`);
    const c = renderSlice(await store.get(i), state.slices[i], state);
    let blob;
    try {
      blob = await encodeCanvas(c, format, quality);
    } finally {
      c.width = c.height = 1;
    }
    checkCancel();
    if (directory) {
      const handle = await directory.getFileHandle(names[i], { create: true });
      const stream = await handle.createWritable();
      try {
        await stream.write(blob);
        await stream.close();
      } catch (e) {
        await stream.abort().catch(() => {});
        throw e;
      }
    } else {
      total += blob.size;
      if (total > 256 * 1024 * 1024)
        throw new Error("ZIP exceeds 256 MB. Use Export to folder.");
      files[names[i]] = new Uint8Array(await blob.arrayBuffer());
    }
    await pause();
  }
  checkCancel();
  const json = JSON.stringify(manifest, null, 2);
  if (directory) {
    const handle = await directory.getFileHandle("transforms.json", {
      create: true,
    });
    const stream = await handle.createWritable();
    try {
      await stream.write(json);
      await stream.close();
    } catch (e) {
      await stream.abort().catch(() => {});
      throw e;
    }
  } else {
    files["transforms.json"] = strToU8(json);
    message("Packaging ZIP…");
    const bytes = await new Promise((resolve, reject) =>
      zip(files, { level: 0 }, (error, data) =>
        error ? reject(error) : resolve(data),
      ),
    );
    checkCancel();
    download(
      new Blob([bytes], { type: "application/zip" }),
      "AlignRef2-aligned.zip",
    );
  }
  message(
    `Exported ${names.length} ${format.toUpperCase()} images and transforms.json${directory ? " to " + directory.name : "."}`,
  );
}
on("export-zip", () => void operation(() => exportImages()));
on("export-folder", () => {
  // Invoke the picker in the original user gesture, before any asynchronous work.
  const pick = window.showDirectoryPicker({ mode: "readwrite" });
  void operation(async () => {
    const root = await pick;
    checkCancel();
    const name =
      "AlignRef2-aligned-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      "-" +
      crypto.randomUUID().slice(0, 6);
    const directory = await root.getDirectoryHandle(name, { create: true });
    await exportImages(directory);
  });
});
update();
