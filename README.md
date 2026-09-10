# AlignRef2 Web beta

**[ブラウザですぐ使う / Launch AlignRef2 →](https://satorumuro.github.io/AlignRef/)**

**[日本語：使い方](https://satorumuro.github.io/AlignRef/guide/ja.html) · [English: How to use](https://satorumuro.github.io/AlignRef/guide/en.html)**

Browser-based alignment of serial 2D images. No installation required.
**AlignRef2 is the recommended workflow for new browser-based work.** The original desktop AlignRef + MultiStackReg workflow remains available under [Legacy workflow](#legacy-workflow).

連続画像の位置合わせをブラウザ内で行う、現在推奨のWeb版です。初めての方は日本語ガイド、またはアプリの **Try demo dataset** から始めてください。

## What is AlignRef2?

AlignRef2 brings automatic rigid registration, visual review, manual refinement, common cropping and image export into one browser workflow. It aligns adjacent sections using translation and rotation; it does not deform tissue or certify anatomical correspondence. Inspect every result and correct it where needed. MultiStackReg is not required for this Web workflow.

## Try the demo

Open [AlignRef2](https://satorumuro.github.io/AlignRef/) and select **Try demo dataset** in **Load images**. It downloads 132 mouse-brain Nissl sections (subj03; 1080 × 840 pixels; about 9.84 MB). No personal images are needed. The demo has not been pre-registered by AlignRef2.

## Features

- Local automatic rigid registration with a chosen reference and channel.
- Adjacent overlays and flicker for visual review.
- F/R and viewer mouse-wheel slice navigation; Ctrl + wheel zoom.
- Recorded manual translation/rotation with explicit Start/End and inclusive Apply range. These endpoints control **manual correction**, not automatic registration.
- Common crop, canvas expansion and undo.
- 8-bit PNG/JPEG folder or ZIP export, plus save/load of transforms.json.

## Supported formats

Input: JPG/JPEG, PNG and a tested subset of TIFF (.tif/.tiff): single-page classic strip TIFF, unsigned 8/16-bit grayscale or interleaved RGB, uncompressed/LZW/Deflate, top-left orientation without alpha. [Full TIFF scope and limits](https://satorumuro.github.io/AlignRef/guide/en.html#formats).

**16-bit TIFF can be loaded and aligned, but display, registration and output use 8-bit data.** Values map from 0–65535 to 0–255 without automatic contrast stretching. Output is PNG or JPEG, not TIFF; 16-bit precision and physical spacing metadata are not retained in exported images.

Desktop **Chrome and Edge** have been tested. Other browsers and mobile image processing are not certified. The guides can be read on narrow screens.

## Privacy / local processing

**Your images stay on your device. Images you load are processed locally in your browser and are not uploaded to any server.**

読み込んだ画像はブラウザ内で処理され、サーバーへアップロードされません。The app downloads its code from this site; **Try demo dataset** downloads public demo images only when clicked. This is distinct from uploading user-loaded images. There is no runtime CDN, analytics client or remote image-processing API.

Save your images and transforms before closing, reloading or replacing a stack: work is session-local.

## Citation

If you use AlignRef in academic work, please cite the related workflow publication:

Muro, S., Ibara, T., Nimura, A. & Akita, K. (2026) Two-step workflow integrating automatic registration and manual refinement for the accurate alignment of serial histological sections in 3D reconstruction. Journal of Anatomy, 00, 1–6. Available from: https://doi.org/10.1111/joa.70203

This citation describes the original two-step workflow; it is not a validation of the independent AlignRef2 Web registration engine. For reproducibility, also record the AlignRef2 commit and settings used.

## License and demo attribution

- **Software code: [Apache-2.0](./LICENSE).** Bundled runtime dependency licenses are in [third-party notices](./web/public/THIRD_PARTY_NOTICES.txt).
- **Demo images: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), separately from software.** Attribution: [Mouse Brain Architecture Project / Brain Architecture Project (BAP)](https://brainarchitecture.org/), under the [BAP Policy](https://brainarchitecture.org/policies/).
- Source host: [JHU subj03 distribution](https://www.cis.jhu.edu/data.sets/mouse_histology/mba_project_experiment/subj03/). The source files were obtained from the JHU-hosted distribution of the Mouse Brain Architecture Project subj03 dataset.
- Demo preparation: odd-numbered slices only, a common 1080 × 840 canvas, and JPEG conversion. Supplied JPEG bytes are distributed unchanged. See [DATA_LICENSE.md](./web/public/demo/mouse-brain-subj03/DATA_LICENSE.md) for attribution, source publication and redistribution requirements. BAP/JHU endorsement is not implied.

## Legacy workflow

The original **AlignRef + MultiStackReg** workflow remains available for reproducibility and compatibility with previous analyses. Its guides, desktop download and source code are retained.

旧 AlignRef と MultiStackReg を併用する従来ワークフローは、過去の解析との互換性・再現性のため Legacy workflow として引き続き提供します。

- [Legacy workflow overview / 従来方式の案内](https://satorumuro.github.io/AlignRef/guide/legacy.html)
- Original desktop guide and download: [English](./LEGACY.md) / [日本語](./README_JP.md)
- MultiStackReg preparation: [English](./RegistrationGuide.md) / [日本語](./RegistrationGuide_JP.md)

## Developer / technical information

- [Web implementation, local development, tests and limitations](./web/README.md)
- [Original Python application](./AlignRef.py) and [desktop UI](./ui_AlignRef.py)
- [GitHub Issues](https://github.com/SatoruMuro/AlignRef/issues) for bug reports and feature requests
- [Publication announcement drafts](./docs/ANNOUNCEMENTS.md)

GitHub Pages publishes the tested web/dist build from main using [GitHub Actions](./.github/workflows/web-beta.yml). Pull requests run validation before merging.
