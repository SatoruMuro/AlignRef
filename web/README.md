# AlignRef2 Web beta

Automatic Registration + Manual Refinement for Serial Images.

**Beta URL:** https://satorumuro.github.io/AlignRef/

**User guides:** [日本語](https://satorumuro.github.io/AlignRef/guide/ja.html) ·
[English](https://satorumuro.github.io/AlignRef/guide/en.html).
This README contains developer and technical details.

The original AlignRef Python application, license and existing distributions are
unchanged. Original documentation is retained under [Legacy workflow](https://satorumuro.github.io/AlignRef/guide/legacy.html).
This directory is an independent browser application. No image is uploaded; no runtime CDN, remote font,
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
Playwright end-to-end tests against the deployed site, using synthetic fixtures and the bundled real demo. Set `ALIGNREF_BROWSER=chrome` or `msedge` to test an installed Chrome/Edge; unset it for bundled Chromium.

## Workflow

1. Choose multiple JPG/JPEG/PNG/TIFF images or a directory. Natural filename order is
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
zoom buttons, Ctrl+wheel and drag-to-pan help inspect the image. Over the viewer, wheel down/up advances/reverses one slice per event burst, with 180 ms of quiet between bursts. Wheel navigation is disabled during processing, recording or while a form field has focus. Outside the viewer, normal page scrolling is unchanged. The visible viewer hint shows R/left and F/right; their keyboard behavior is unchanged. Overlays always
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
  result commits after traversing all pairs. Failed pairs inherit the parent automatic transform with explicit QC warnings; descendants are flagged. Cancellation or total failure preserves all previous transforms.
- `src/images.js`: browser decoding, three-image LRU, channel proxies, RGB Canvas
  rendering from original data, PNG/JPEG encoding and deterministic export names.
- `src/main.js`: DOM controls, viewer, recording lifecycle, async operations,
  folder/ZIP export, progress/cancellation and local file import.

The proxy uses one isotropic scale, with rounded-up canvas dimensions. Translation
terms are divided by that scale before pairwise accumulation. Rotations are never
rescaled. Pyramid coordinate conversion accounts for odd dimensions. Full-size
output is rendered from the decoded 8-bit source representation (including the documented TIFF conversion) in one Canvas draw, after composing
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
Legacy guide guidance about equal-digit names still describes the unchanged desktop
version; Web uses natural sort. No desktop fixes or distribution changes are made.

## Dependencies and license

New source: Apache-2.0, under the repository's existing LICENSE.
Runtime: fflate 0.8.3 (MIT) for ZIP export and TIFF Deflate; tiff 7.1.3 (MIT) and iobuffer 6.0.1 (MIT) for TIFF decoding. All are bundled locally.
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
atomic total registration failure, and partial pair failure with explicit fallback. It audits console errors, failed HTTP responses
and requests leaving the site origin.

## GitHub Pages

`.github/workflows/web-beta.yml` runs install, unit tests, build, Chromium end-to-end
checks, uploads the static artifact, then uses official GitHub Pages Actions.
PRs and beta-branch pushes run validation only. **Only main deploys** after the
build and tests succeed, so a later beta-branch push cannot replace production.
Repository Pages uses **GitHub Actions** and the `github-pages` environment must
permit main. Workflow dispatch on main also validates before deployment.
No Python dependency or packaging action is changed.

Static user guides live in `public/guide/` and are copied unchanged into the Pages
artifact by Vite. They use local CSS, no JavaScript, analytics or external fonts.
Application help links open a new tab to keep the current stack available.

## Known beta limits

- Adjacent content should remain similar, roughly within ±30 degrees and moderate
  displacement; optimization is bounded at ±40 degrees and 40% translation.
  Low contrast, repetition, missing tissue and large morphological changes can
  fail or produce a poor local optimum. NCC below 0.35 rejects a pair; below 0.7
  marks it for closer QC. A failed pair uses an identity relative transform (inherits the parent automatic matrix), is flagged, and descendants are flagged for inspection. If every pair fails or the user cancels, existing transforms remain unchanged. Accumulated rotation beyond 90 degrees or center displacement beyond half the larger canvas side is also flagged; these warnings do not certify other transforms as anatomically correct. These are heuristics, not validated scientific accuracy
  or equivalence to MultiStackReg. The bundled 132-image subj03 demo has an end-to-end browser test; this checks technical operation, not anatomical correctness.
- Pairwise drift can accumulate; visual QC/manual correction remain essential.
  Re-running automatic registration replaces automatic matrices and retains manual
  matrices, so review any previously applied manual correction afterward.
- JPG/PNG and the documented TIFF subset, represented as 8-bit RGBA; no DICOM, 16-bit export, ICC/EXIF
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


## Bundled real demo and image licensing

**Try demo dataset** in step 1 loads 132 mouse brain Nissl images from subj03.
The image payload is 9,840,092 bytes, each JPEG is 1080 × 840, and odd-numbered
sections image0001 through image0263 are retained. Nothing in `public/demo/`
is fetched during initial page load. Clicking loads the manifest and attribution
notice, then at most eight images concurrently, with progress and cancellation.
HTTP failure, missing/invalid images and cancellation leave the existing stack
intact. Downloaded File objects go through the same dimension inspection,
non-scaling center-padding, model and registration pipeline as user images.
Choose images/folder again to replace the stack and reset its metadata/history.

The dataset is **CC BY-SA 4.0**, separately from **Apache-2.0 source code**.
Attribution: [Brain Architecture Project (BAP)](https://brainarchitecture.org/).
See [BAP Policy](https://brainarchitecture.org/policies/),
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), and
[JHU source host](https://www.cis.jhu.edu/data.sets/mouse_histology/mba_project_experiment/subj03/).
[DATA_LICENSE.md](public/demo/mouse-brain-subj03/DATA_LICENSE.md) records the
origin and actual preparation: alternate odd sections, common canvas and JPEG.
Supplied JPEG bytes are distributed unchanged. JHU is the source host; BAP Policy
is the licensing basis. No BAP/JHU endorsement is implied.

The notice appears in the demo info panel and in the export step when demo data
is active. Both ZIP and folder image exports include DATA_LICENSE.md and dataset
provenance in transforms.json. Recipients sharing adapted demo images must retain
attribution, link the license, indicate changes and use CC BY-SA 4.0. User-loaded
image stacks do not acquire this demo metadata through transform import.

The real browser test covers all 132 downloads, default Gray/768 px rigid
registration, finite rigid matrices, accumulated motion diagnostics, adjacent
overlays, two-slice manual range correction, crop, actual PNG decoding, JPEG,
license packaging, demo-to-user reset, network errors and cancellation. It records
load/registration/export timing, sampled main-page JavaScript heap and timer delay
in test-results. Heap samples exclude native bitmap/GPU/worker memory and are not
a total browser RAM measurement. Long registration is performed in Workers;
image loading and export yield between images. Original JPEG Files and at most
three decoded source bitmaps are retained, not 132 full RGBA originals.

## TIFF input: explicit beta subset

The app uses **tiff 7.1.3** in a bundled module Worker. It does not rely on the
browser's native TIFF decoder and does not load a remote CDN. TIFF decoding can
be cancelled; an individual decode times out after 60 seconds. Original File
objects remain unchanged; the same center-padding, registration, manual, crop
and export pipeline is used for TIFF, PNG and JPEG.

| Feature | Supported by this beta |
|---|---|
| Container | Classic TIFF, one page per file, little- or big-endian |
| Pixel types | Grayscale (BlackIsZero / WhiteIsZero), RGB |
| Samples | Unsigned 8-bit or unsigned 16-bit; uniform depth across channels |
| Layout | Strips, interleaved RGB, top-left orientation, normal fill order |
| Compression | None (1), LZW (5), Zlib/Deflate (8 / 32946) |
| Predictor | None (1), horizontal differencing (2) |
| Not supported | Multi-page, tiled, BigTIFF, planar-separated RGB, alpha/extra channels, palette, CMYK, bilevel, signed integers, floating point, PackBits, JPEG/CCITT compression, other orientation/fill-order/predictor values |

Unsupported or inconsistent files produce a filename-specific error and leave
the previous stack unchanged. Save multi-page stacks as separate files before
loading. The integration intentionally accepts a narrower subset than the
underlying decoder; the table describes AlignRef2, not all decoder capabilities.

**16-bit handling:** the decoder first produces unsigned 16-bit samples. For
display/registration they are converted with `round(value / 257)` to 8-bit RGBA
(0–65535 → 0–255). WhiteIsZero samples are inverted by the decoder before this
conversion. No per-image contrast stretching is applied; images using only a
small part of the 16-bit range may appear dark and lose useful contrast. The
16-bit decoded array is temporary, while the original TIFF File is retained.
The bitmap cache holds at most three decoded 8-bit representations.

**Export is 8-bit PNG or JPEG**, including for 16-bit input. PNG avoids additional
lossy encoding but does not recover the discarded 16-bit precision. Source bit
depth, compression, conversion and representation/export bit depths are recorded
per slice in `transforms.json`. TIFF export and high-bit-depth editing are not
implemented. ICC/EXIF/resolution and physical spacing do not round-trip.

### Decoder selection and license

| Candidate | License / approach | Decision |
|---|---|---|
| [image-js/tiff](https://github.com/image-js/tiff), npm tiff 7.1.3 | MIT; ES modules, typed unsigned-16 sample output; shares existing fflate dependency; iobuffer is MIT | Selected; permits an explicit and testable conversion step |
| [UTIF.js](https://github.com/photopea/UTIF.js), npm utif 3.1.0 | MIT; broader format support, low-level IFD API and toRGBA8 helper; CommonJS and pako dependency | Considered; the wider variant surface is unnecessary for this beta subset |

Both are permissively licensed. The selected decoder's and iobuffer's full MIT
notices ship in THIRD_PARTY_NOTICES.txt. AlignRef2 code remains Apache-2.0; the
BAP demo image dataset remains separately CC BY-SA 4.0. No new runtime service
or upload endpoint is introduced.

## Local processing and privacy

**Your images stay on your device. Images you load are processed locally in your
browser and are not uploaded to any server.** This is displayed beside the load
controls before file selection.

The production app, Workers and bundled decoder were inspected for fetch,
XMLHttpRequest, WebSocket, sendBeacon, telemetry, analytics and external API
calls. Application fetch is confined to the public demo loader. Bundled scripts
are fetched from the AlignRef site; Worker postMessage transfers image data
within the browser and is not an HTTP upload. There is no image POST/PUT,
analytics client, WebSocket connection or server processing component.

User-loaded images are local-only. **Try demo dataset** downloads public images
from this AlignRef site's GitHub Pages hosting when clicked. This is a download,
and does not transmit the user's local images. External attribution/documentation
links navigate only when clicked.

Browser tests audit request methods/bodies and origins, HTTP errors, WebSockets
and console errors during local TIFF load, registration, manual refinement and
export. Synthetic TIFF fixtures (8-bit grayscale, RGB8 LZW, Gray16 Deflate,
WhiteIsZero, big-endian RGB16 LZW and predictor 2) live in tests/fixtures/tiff;
their deterministic generator is tests/make-tiff-fixtures.mjs. They are test
assets, not part of the public demo. Known pixel probes verify conversion and
actual exported PNG pixels; translated fixtures verify automatic restoration.

## Range feedback

The manual panel always shows separate Start and End values (unset: em dash;
set: slice number and checkmark). Set buttons show a quiet active style and a
2.5-second status message. Before Apply, the inclusive normalized target range
is displayed. If Start > End, both entered values remain visible, and the label
explains that both endpoints are retained while applying to the intervening
slices. Finish Recording retains the existing behavior of setting both endpoints
to the current slice. Loading a new stack resets these indicators.
