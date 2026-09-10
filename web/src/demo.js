// SPDX-License-Identifier: Apache-2.0
// No network work occurs until loadDemo is called by the user's click.
export function demoURL(base, file = "manifest.json") {
  return `${base.replace(/\/?$/, "/")}demo/mouse-brain-subj03/${file}`;
}

export function validateManifest(m) {
  const expected = Array.from({ length: 132 }, (_, i) =>
    `image${String(i * 2 + 1).padStart(4, "0")}.jpg`);
  if (m?.id !== "mouse-brain-subj03-nissl-half" || m.imageCount !== 132 ||
      m.width !== 1080 || m.height !== 840 || m.format !== "jpeg" ||
      m.license !== "CC-BY-SA-4.0" || !Array.isArray(m.files) ||
      m.files.length !== expected.length || m.files.some((f, i) => f !== expected[i]))
    throw new Error("Invalid demo manifest. Stack unchanged.");
  return m;
}

export async function loadDemo(base, {
  fetcher = fetch, signal, progress = () => {}, concurrency = 8,
} = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  async function get(file) {
    controller.signal.throwIfAborted();
    let response;
    try { response = await fetcher(demoURL(base, file), { signal: controller.signal }); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error(`Demo download failed: ${file}. ${error.message} Stack unchanged; try again.`);
    }
    if (!response.ok) throw new Error(`Demo download failed: ${file} (HTTP ${response.status}). Stack unchanged; try again.`);
    return response;
  }
  try {
    const manifest = validateManifest(await (await get("manifest.json")).json());
    const notice = await (await get("DATA_LICENSE.md")).text();
    if (!notice.includes("CC BY-SA 4.0")) throw new Error("Demo license notice is missing. Stack unchanged.");
    const files = new Array(manifest.files.length);
    let cursor = 0, completed = 0, failure;
    progress(0, files.length);
    // Await all workers on failure, so no download survives into a later load.
    const workers = Array.from({ length: Math.max(1, Math.min(12, Math.floor(concurrency) || 8)) }, async () => {
      try {
        while (cursor < files.length) {
          controller.signal.throwIfAborted();
          const i = cursor++, name = manifest.files[i];
          const blob = await (await get(name)).blob();
          if (!blob.size) throw new Error(`Empty demo image: ${name}. Stack unchanged.`);
          files[i] = new File([blob], name, { type: "image/jpeg" });
          progress(++completed, files.length);
        }
      } catch (error) {
        failure ??= error;
        controller.abort();
      }
    });
    await Promise.all(workers);
    if (failure) throw failure;
    controller.signal.throwIfAborted();
    return { files, dataset: { ...manifest, notice } };
  } finally {
    signal?.removeEventListener("abort", abort);
    controller.abort();
  }
}

export function exportDataNotice(dataset) {
  return `${dataset.notice}\n\n## This export\n\nExported from AlignRef2. Rigid transforms, canvas background and output crop are recorded in transforms.json; output images were rendered as PNG or JPEG. Retain the original credit and change history. When sharing adapted demo images, apply CC BY-SA 4.0 and indicate your additional changes. This image license does not change the Apache-2.0 license of AlignRef2 source code.\n`;
}
