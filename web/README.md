# AlignRef2 Web beta

Automatic Registration + Manual Refinement for Serial Images.

**Beta URL:** https://satorumuro.github.io/AlignRef/

The supported AlignRef Python application, its README files, registration guides,
license and existing distributions are unchanged. This directory is an additive,
independent browser application. No image is uploaded; no runtime CDN, remote font,
telemetry, OpenCV bootstrap or server component is used.

## Run and verify

Node 24 (minimum 22.12), then in `web/`:

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run dev
```

Vite serves `/AlignRef/`. `npm run preview` serves the production build.
Set `ALIGNREF_BASE_URL=https://satorumuro.github.io/AlignRef/` to run the same
Playwright end-to-end tests against the deployed site, using synthetic images only.

## Workflow

1. Choose multiple JPG/JPEG/PNG images or a directory. Natural filename order is
   used (`image1`, `image2`, `image10`). Select White/Black background. Every source
   retains its native pixel size; center padding uses the maximum width/height,
   with an extra pixel on the right/bottom when the difference is odd. Originals
   remain as File objects; there is no intermediate JPEG encoding.
2. Select Gray/Red/Green/Blue, proxy maximum side (512/768/1024/1536), and Middle
   (upper middle for an even stack) or Current reference. Run Rigid Registration.
   Adjacent pairs are registered from the reference outwards in both directions.
   Check the correlation readout and inspect **every** pair with overlays.
3. Start Recording Position; WASD/arrows/OKL; move 1 original-resolution pixel,
   QE/IP rotate 0.1 degrees. Shift multiplies the step by ten. The preview uses
   the output viewport center as its rotation pivot. Finish stores this exact
   correction and removes the preview; it does **not** modify any slice. Set
   Position Start/End (inclusive, either direction) and Apply Position & Rotation.
   This applies the correction once to each selected slice. Start=End adjusts one
   slice. Cancel Recording discards the preview. Undo/Ctrl+Z restores the last
   mutation, up to 50 operations. Recording locks navigation to its source slice.
4. Start Crop and drag a common rectangle. Move it from inside or resize at a
   corner; numeric fields provide exact coordinates. Apply Crop changes the
   output viewport only. Undo Crop restores the previous crop viewport, retaining
   subsequent alignment changes. Clear Crop Box only removes the pending box.
   Expand Canvas adds 100 pixels on all sides of the current viewport without
   scaling or discarding source content.
5. Export PNG (default) or JPEG. Chrome/Edge folder export creates a new uniquely
   named subdirectory and writes one image at a time. ZIP export holds compressed
   image files in memory, with a 256 MB encoded-data ceiling; it uses ZIP store
   mode because PNG/JPEG are already compressed. Original basenames and order are
   retained; collisions get deterministic suffixes. `transforms.json` is included.

Outside recording, arrows, F/J/PageDown and R/U/PageUp navigate. Fit to Window,
zoom buttons, Ctrl+wheel and drag-to-pan help inspect the image. Overlays always
show the neighbor's composed transform; the current preview does not move the
neighbor. Opacity includes background padding; flicker alternates complete images.

## Architecture

- `src/geometry.js`: rigid Canvas matrices, composition/inverse, natural ordering,
  center padding and ROI normalization.
- `src/model.js`: immutable transform/viewport state, range operations, bounded
  snapshot undo and strict versioned JSON validation. Pixel buffers are excluded
  from history.
- `src/registration.js`: original JavaScript multiresolution normalized
  cross-correlation optimizer; only three rigid parameters are searched. Contrast
  centroids and multiple angle/translation seeds initialize a coarse pyramid;
  coordinate descent refines to subpixel translations and small angular steps.
  Source-support masks exclude artificial padding from the similarity score.
- `src/registration.worker.js`: module Worker for each pair, bundled by Vite and
  loaded from this site's `/AlignRef/assets/`. Cancellation terminates it. The
  entire automatic result commits atomically after all pairs succeed. A failure
  identifies the pair; previous transforms remain available for manual correction.
- `src/images.js`: browser decoding, three-image LRU, channel proxies, RGB Canvas
  rendering from original data, PNG/JPEG encoding and deterministic export names.
- `src/main.js`: DOM controls, viewer, recording lifecycle, async operations,
  folder/ZIP export, progress/cancellation and local file import.

The proxy uses one isotropic scale, with rounded-up canvas dimensions. Translation
terms are divided by that scale before pairwise accumulation. Rotations are never
rescaled. Pyramid coordinate conversion accounts for odd dimensions. Full-size
output is rendered directly from original RGB in one Canvas draw, after composing
all transforms. Repeated refinement does not repeatedly re-encode image data.

The independent implementation does not use or copy MultiStackReg or TurboReg.
It is not an OpenCV/ECC implementation. No WASM is required, so there are no WASM
assets or dynamic CDN dependencies that can fail to load. All JavaScript, Workers,
CSS and license notices are served with the Pages build.

## Transform format (version 1)

Coordinates are pixels in the initial maximum-size center-padded canvas, with x
right and y down. Matrices use Canvas `[a,b,c,d,e,f]`:

```
x' = a*x + c*y + e
y' = b*x + d*y + f
finalTransform = manualTransform * automaticTransform
```

Matrices map **source to output reference**, not output sampling coordinates.
Positive rotation is clockwise. Each slice stores index, name, source dimensions,
automaticTransform, manualTransform, finalTransform and optional QC metadata.
The initial canvas stays fixed. `viewport` specifies the final crop/padding in
reference coordinates; subtract its x/y when rendering the final exported image.
`finalTransform` deliberately excludes this final viewport translation.

Import replaces transforms/background/viewport atomically, validates rigid-only
matrices and their composition, and checks stack count, canvas and each source
image's dimensions. Mapping is by natural slice order, allowing another RGB
channel or another identically sized stack with different filenames. The caller
must provide corresponding slices in that order; names are not a biological
correspondence check. Invalid, affine or inconsistent files are rejected.

## Existing desktop behavior reviewed

Reviewed `AlignRef.py`, `ui_AlignRef.py`, `README.md`, `README_JP.md`,
`RegistrationGuide.md`, `RegistrationGuide_JP.md`, and `LICENSE` at baseline
`afaaa33`. The desktop workflow centers unequal images on a maximum-size canvas,
uses 1 px/0.1 degree preview steps, records before inclusive range application,
shows adjacent overlays at 50%, and expands 100 px per side. Its internal JPEG
conversion and pixel-rewriting crop/apply mechanisms are intentionally replaced
in the Web application by source preservation and transform state. Existing
README guidance about equal-digit names still describes the unchanged desktop
version; Web uses natural sort. No desktop fixes or distribution changes are made.

## Dependencies and license

New source: Apache-2.0, under the repository's existing LICENSE.
Runtime: fflate 0.8.3 (MIT), bundled locally for ZIP export.
Build: Vite 8.2.2 (MIT); test: Playwright 1.63.0 (Apache-2.0).
The npm lockfile pins transitive dependencies. Full runtime license text ships in
`public/THIRD_PARTY_NOTICES.txt`; Apache-2.0 ships in `public/LICENSE.txt`.
Browser decoding/Canvas/File System Access/Workers are platform APIs.

## Tests

Node synthetic tests cover known translations, rotations and combinations,
composition direction, pairwise order/proxy scaling, unequal padding, natural
sort, range endpoints, undo, crop/expand, filename collisions and strict JSON
round trips. Textureless registration must fail explicitly.

Playwright exercises the production `/AlignRef/` build, not the development
server. It verifies automatic restoration at original resolution with a 512 px
proxy, RGB image export pixel agreement, preview/finish/range/undo semantics,
common crop/undo, mixed input dimensions/black padding, JPEG, transform transfer,
and atomic registration failure. It audits console errors, failed HTTP responses
and requests leaving the site origin.

## GitHub Pages

`.github/workflows/web-beta.yml` runs install, unit tests, build, Chromium end-to-end
checks, uploads the static artifact, then uses official GitHub Pages Actions.
PRs run validation only. The beta work branch can deploy without merging into
main; main can deploy after review. Repository Pages must use **GitHub Actions**
and its `github-pages` environment must permit the beta branch. Workflow dispatch
requires the workflow to exist on the default branch; the beta initially deploys
via its push event instead. No Python dependency or packaging action is changed.

## Known beta limits

- Adjacent content should remain similar, roughly within ±30 degrees and moderate
  displacement; optimization is bounded at ±40 degrees and 40% translation.
  Low contrast, repetition, missing tissue and large morphological changes can
  fail or produce a poor local optimum. NCC below 0.35 rejects a pair; below 0.7
  marks it for closer QC. These are heuristics, not validated scientific accuracy
  or equivalence to MultiStackReg. No histology dataset validation is claimed.
- Pairwise drift can accumulate; visual QC/manual correction remain essential.
  Re-running automatic registration replaces automatic matrices and retains manual
  matrices, so review any previously applied manual correction afterward.
- JPG/PNG only, browser-decoded 8-bit RGBA; no TIFF, DICOM, 16-bit workflow, ICC/EXIF
  metadata round-trip or physical spacing preservation. Canvas color management
  follows the browser. Exported PNG is lossless relative to rendered 8-bit pixels.
- Original File references and at most three decoded source bitmaps are retained;
  large images still require significant RAM. Canvas is capped at 32,767 px per
  side / 100 MP; practical browser/device limits can be lower. ZIP retains all
  encoded files and may need several times its final size in memory. Folder export
  is preferred for larger stacks and is not available in every browser.
- Changes are session-local. Save transforms before reload/closing/loading another
  stack. Cancellation leaves any already-written export files in the new folder.
- Primarily desktop Chrome/Edge; mobile and other browsers are not certified.
