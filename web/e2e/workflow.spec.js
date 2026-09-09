import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { compose, rigid, point } from "../src/geometry.js";

async function download(page, id) {
  const pending = page.waitForEvent("download");
  await page.locator("#" + id).click();
  const d = await pending;
  return readFile(await d.path());
}
async function manifest(page) {
  return JSON.parse((await download(page, "export-transforms")).toString());
}
async function fixtures(page, options = {}) {
  const values = await page.evaluate(
    ({ width = 960, height = 720, mixed = false, blank = false }) => {
      return [
        [13, -9, -7],
        [0, 0, 0],
        [-16, 11, 9],
      ].map(([dx, dy, angle], i) => {
        const w = mixed && i === 0 ? width - 51 : width,
          h = mixed && i === 0 ? height - 31 : height;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d"),
          im = ctx.createImageData(w, h);
        const a = (-angle * Math.PI) / 180,
          co = Math.cos(a),
          si = Math.sin(a),
          factor = width / 256;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const px =
              co * (x + 0.5 - width / 2 - dx) -
              si * (y + 0.5 - height / 2 - dy) +
              width / 2;
            const py =
              si * (x + 0.5 - width / 2 - dx) +
              co * (y + 0.5 - height / 2 - dy) +
              height / 2;
            let v = 0.94;
            if (!blank)
              for (const [cx, cy, sx, sy, am] of [
                [61, 55, 15, 21, 0.6],
                [153, 112, 25, 13, 0.5],
                [103, 136, 12, 10, 0.65],
                [187, 48, 10, 17, 0.6],
                [124, 75, 8, 12, 0.4],
              ])
                v -=
                  am *
                  Math.exp(
                    -(
                      (px / factor - cx) ** 2 / (2 * sx * sx) +
                      (py / factor - cy) ** 2 / (2 * sy * sy)
                    ),
                  );
            const k = (y * w + x) * 4;
            im.data[k] = Math.round(60 + v * 120);
            im.data[k + 1] = Math.round(v * 255);
            im.data[k + 2] = Math.round(30 + v * 90);
            im.data[k + 3] = 255;
          }
        ctx.putImageData(im, 0, 0);
        return c.toDataURL().split(",")[1];
      });
    },
    options,
  );
  return values.map((v, i) => ({
    name: ["image1.png", "image2.png", "image10.png"][i],
    mimeType: "image/png",
    buffer: Buffer.from(v, "base64"),
  }));
}
function audit(page) {
  const errors = [],
    external = [],
    badResponses = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
  });
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      new URL(r.url()).origin !==
        new URL(process.env.ALIGNREF_BASE_URL || "http://127.0.0.1:4173").origin
    )
      external.push(r.url());
  });
  return { errors, external, badResponses };
}
test("production Pages base: load → rigid registration → overlay → range refinement → undo → crop → PNG ZIP → reuse transforms", async ({
  page,
}, testInfo) => {
  const log = audit(page);
  await page.goto("./");
  const files = await fixtures(page);
  await page.locator("#files").setInputFiles([files[2], files[0], files[1]]);
  await expect(page.locator("#status")).toContainText("Loaded 3 images");
  await expect(page.locator("#filename")).toHaveText("image2.png");
  await page.locator("#channel").selectOption("Green");
  await page.locator("#proxy").selectOption("512");
  await page.locator("#register").click();
  await expect(page.locator("#status")).toContainText(
    "Rigid registration complete",
    { timeout: 90000 },
  );
  const registered = await manifest(page);
  expect(registered.slices.map((s) => s.name)).toEqual([
    "image1.png",
    "image2.png",
    "image10.png",
  ]);
  for (const [i, dx, dy, a] of [
    [0, 13, -9, -7],
    [2, -16, 11, 9],
  ]) {
    const residual = compose(
      registered.slices[i].automaticTransform,
      rigid(dx, dy, a, 480, 360),
    );
    for (const p of [
      [160, 160],
      [700, 150],
      [500, 550],
    ]) {
      const q = point(residual, ...p);
      expect(Math.hypot(q[0] - p[0], q[1] - p[1])).toBeLessThan(1.5);
    }
  }
  await page.locator("#overlay-prev").click();
  await page.locator("#opacity").fill("0.7");
  await page.locator("#flicker").check();
  await page.waitForTimeout(550);
  await page.locator("#clear-overlay").click();
  await page.locator("#overlay-next").click();
  await page.locator("#record").click();
  await page.keyboard.press("Shift+D");
  await page.keyboard.press("q");
  await expect(page.locator("#recorded")).toContainText("ΔX 10.0");
  await page.locator("#finish").click();
  const beforeApply = await manifest(page);
  expect(beforeApply.slices.map((s) => s.manualTransform)).toEqual(
    registered.slices.map((s) => s.manualTransform),
  );
  await page.locator("#prev").click();
  await page.locator("#range-start").click();
  await page.locator("#next").click();
  await page.locator("#next").click();
  await page.locator("#range-end").click();
  await page.locator("#apply-range").click();
  const applied = await manifest(page);
  for (const s of applied.slices)
    expect(s.manualTransform).toEqual(rigid(10, 0, -0.1, 480, 360));
  await page.locator("#undo").click();
  const undone = await manifest(page);
  expect(undone.slices).toEqual(registered.slices);
  await page.locator("#apply-range").click();
  await page.locator("#clear-overlay").click();
  await page.locator("#start-crop").click();
  const box = await page.locator("#viewer").boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(page.locator("#apply-crop")).toBeEnabled();
  await page.locator("#apply-crop").click();
  const cropped = await manifest(page);
  expect(cropped.viewport.width).toBeLessThan(960);
  expect(cropped.viewport.height).toBeLessThan(720);
  await page.locator("#undo-crop").click();
  expect((await manifest(page)).viewport).toEqual(registered.viewport);
  await page.locator("#undo").click();
  expect((await manifest(page)).viewport).toEqual(cropped.viewport);
  const bytes = await download(page, "export-zip"),
    zip = unzipSync(bytes);
  expect(Object.keys(zip)).toEqual([
    "image1.png",
    "image2.png",
    "image10.png",
    "transforms.json",
  ]);
  const saved = JSON.parse(strFromU8(zip["transforms.json"]));
  expect(saved.viewport).toEqual(cropped.viewport);
  for (const name of saved.exportFiles) {
    const png = Buffer.from(zip[name]);
    expect(png.readUInt32BE(16)).toBe(saved.viewport.width);
    expect(png.readUInt32BE(20)).toBe(saved.viewport.height);
  }
  // Compare real rendered RGB exports, independently of stored matrices.
  const pixelError = await page.evaluate(
    async (images) => {
      const arrays = [];
      for (const data of images) {
        const b = await createImageBitmap(
          new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], {
            type: "image/png",
          }),
        );
        const c = document.createElement("canvas");
        c.width = b.width;
        c.height = b.height;
        const x = c.getContext("2d");
        x.drawImage(b, 0, 0);
        arrays.push(x.getImageData(0, 0, c.width, c.height).data);
        b.close();
      }
      let sum = 0,
        n = 0;
      for (const i of [0, 2])
        for (let k = 0; k < arrays[1].length; k++) {
          if (k % 4 === 3) continue;
          sum += (arrays[i][k] - arrays[1][k]) ** 2;
          n++;
        }
      return Math.sqrt(sum / n);
    },
    saved.exportFiles.map((n) => Buffer.from(zip[n]).toString("base64")),
  );
  expect(pixelError).toBeLessThan(2);
  await page.screenshot({ path: testInfo.outputPath("workflow.png") });
  await page
    .locator("#files")
    .setInputFiles(files.map((f) => ({ ...f, name: "alternate-" + f.name })));
  await expect(page.locator("#status")).toContainText("Loaded 3 images");
  await page
    .locator("#transform-file")
    .setInputFiles({
      name: "transforms.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(saved)),
    });
  await expect(page.locator("#status")).toContainText("Transforms loaded");
  const reused = await manifest(page);
  expect(reused.slices[0].finalTransform).toEqual(
    saved.slices[0].finalTransform,
  );
  expect(reused.slices[0].name).toBe("alternate-image1.png");
  expect(log).toEqual({ errors: [], external: [], badResponses: [] });
});
test("mixed dimensions, black padding, cancel recording, expansion and JPEG export", async ({
  page,
}) => {
  const log = audit(page);
  await page.goto("./");
  const files = await fixtures(page, { width: 256, height: 192, mixed: true });
  await page.locator("#background").selectOption("black");
  await page.locator("#files").setInputFiles(files);
  await expect(page.locator("#status")).toContainText("Loaded 3 images");
  await page.locator("#prev").click();
  await page.locator("#record").click();
  await page.keyboard.press("d");
  await page.locator("#cancel-record").click();
  expect((await manifest(page)).slices[0].manualTransform).toEqual([
    1, 0, 0, 1, 0, 0,
  ]);
  const pngs = unzipSync(await download(page, "export-zip"));
  const pixels = await page.evaluate(async (data) => {
    const b = await createImageBitmap(
      new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], {
        type: "image/png",
      }),
    );
    const c = document.createElement("canvas");
    c.width = b.width;
    c.height = b.height;
    const x = c.getContext("2d");
    x.drawImage(b, 0, 0);
    return {
      corner: [...x.getImageData(0, 0, 1, 1).data],
      inside: [...x.getImageData(30, 20, 1, 1).data],
    };
  }, Buffer.from(pngs["image1.png"]).toString("base64"));
  expect(pixels.corner).toEqual([0, 0, 0, 255]);
  expect(pixels.inside[1]).toBeGreaterThan(0);
  await page.locator("#expand").click();
  const expanded = await manifest(page);
  expect(expanded.viewport).toEqual({
    x: -100,
    y: -100,
    width: 456,
    height: 392,
  });
  await page.locator("#format").selectOption("jpeg");
  const jpgs = unzipSync(await download(page, "export-zip"));
  expect([...jpgs["image1.jpg"].slice(0, 2)]).toEqual([255, 216]);
  expect(log).toEqual({ errors: [], external: [], badResponses: [] });
});
test("failed registration is atomic and manual tools remain available", async ({
  page,
}) => {
  const log = audit(page);
  await page.goto("./");
  await page
    .locator("#files")
    .setInputFiles(
      await fixtures(page, { width: 128, height: 96, blank: true }),
    );
  await expect(page.locator("#status")).toContainText("Loaded 3 images");
  await page.locator("#register").click();
  await expect(page.locator("#status")).toContainText(
    "No automatic transforms were changed",
  );
  expect(
    (await manifest(page)).slices.every(
      (s) => s.automaticTransform.join(",") === "1,0,0,1,0,0",
    ),
  ).toBe(true);
  await expect(page.locator("#record")).toBeEnabled();
  expect(log).toEqual({ errors: [], external: [], badResponses: [] });
});

test("folder export writes sequentially through File System Access handles and cancellation is atomic", async ({
  page,
}) => {
  const log = audit(page);
  await page.addInitScript(() => {
    window.showDirectoryPicker = () => navigator.storage.getDirectory();
  });
  await page.goto("./");
  await page
    .locator("#files")
    .setInputFiles(await fixtures(page, { width: 256, height: 192 }));
  await expect(page.locator("#status")).toContainText("Loaded 3 images");
  await page.locator("#register").click();
  await page.locator("#cancel-job").click();
  await expect(page.locator("#status")).toContainText("Operation cancelled");
  const untouched = await manifest(page);
  expect(
    untouched.slices.every(
      (s) => s.automaticTransform.join(",") === "1,0,0,1,0,0",
    ),
  ).toBe(true);
  await page.locator("#export-folder").click();
  await expect(page.locator("#status")).toContainText("Exported 3 PNG images");
  const saved = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory(),
      folders = [];
    for await (const [name, handle] of root.entries())
      if (handle.kind === "directory") folders.push(name);
    const dir = await root.getDirectoryHandle(folders.sort().at(-1)),
      files = {};
    for await (const [name, handle] of dir.entries()) {
      const f = await handle.getFile();
      files[name] = { size: f.size, type: f.type };
    }
    const json = JSON.parse(
      await (
        await (await dir.getFileHandle("transforms.json")).getFile()
      ).text(),
    );
    return { files, names: json.exportFiles };
  });
  expect(Object.keys(saved.files).sort()).toEqual([
    "image1.png",
    "image10.png",
    "image2.png",
    "transforms.json",
  ]);
  expect(saved.names).toEqual(["image1.png", "image2.png", "image10.png"]);
  expect(saved.files["image1.png"].size).toBeGreaterThan(100);
  // Invalid import must preserve all existing state.
  const invalid = structuredClone(untouched);
  invalid.slices[0].automaticTransform[0] = 2;
  await page
    .locator("#transform-file")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(invalid)),
    });
  await expect(page.locator("#status")).toContainText(
    "rigid matrix is invalid",
  );
  expect(await manifest(page)).toEqual(untouched);
  expect(log).toEqual({ errors: [], external: [], badResponses: [] });
});
