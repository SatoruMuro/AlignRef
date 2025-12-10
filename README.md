# AlignRef

👉 **日本語版はこちら:** [README_JP.md](./README_JP.md)  

**AlignRef** is a lightweight desktop application for interactive alignment and preprocessing of serial images  
(e.g., histological sections, CT/MRI slices, or photographic image sequences).

It provides:
- Keyboard-based fine adjustment of position and rotation
- Overlay visualization between adjacent images
- Batch cropping with a shared ROI
- Batch export to multiple formats (JPG/PNG/BMP/TIFF/DICOM)
- Simple, installer-free distribution as a standalone Windows .exe

> 🧪 Designed for anatomical and morphological research workflows, but can be used in any image-based project.

---

> **Important — Before Using AlignRef**
> 
> AlignRef is designed as a **post-registration fine-adjustment tool**.  
> For serial histological sections, please perform **automatic registration** first  
> using ImageJ/Fiji + MultiStackReg.
> 
> 👉 **Registration Guide (English)**  
> https://github.com/SatoruMuro/AlignRef/blob/main/RegistrationGuide.md
> 
> 👉 **Registration Guide (Japanese / 日本語)**  
> https://github.com/SatoruMuro/AlignRef/blob/main/RegistrationGuide_JP.md

---

## 📦 Download

👉 **Direct download (ZIP)**  
[Download AlignRef.zip via Dropbox](https://www.dropbox.com/scl/fi/dggt20l4g0w8cgq097i35/AlignRef.zip?rlkey=fck23rub5t2edgyxcn0ycnvpq&st=hb6skgpf&dl=1)

> The link starts the download automatically. No installer is required.

---

## 💻 System Requirements

- **OS**: Windows 10 or later (64-bit)
- **RAM**: 8 GB or more recommended (depends on image size and number of images)
- **GPU**: Not required
- **.exe**: No Python installation is needed for end users

---

## 🚀 Installation & Launch

1. Download the ZIP file from the link above.
2. Unzip it and create a folder such as:  
   `C:\AlignRef\`
3. Place **all contents** of the ZIP file into that folder  
   (including `AlignRef.exe` and the `_internal` folder).

⚠️ **Important Path Notes**

- Avoid placing AlignRef in folders with:
  - Very long paths
  - Japanese characters
  - Spaces in the path (e.g., Desktop or Documents)
- Example of a safe path:  
  `C:\AlignRef\`

4. Double-click `AlignRef.exe` to launch.

> ⚠️ If Windows SmartScreen shows a warning, click **“More info” → “Run anyway”**.  
> ❗ Do **not delete** the `_internal` folder. It is required for the app to run.

---

## 🖼️ Loading and Viewing Images

1. Click **`Load Image Folder`** and select a folder containing your images.
2. Supported formats include **JPG, PNG, BMP, TIFF, DICOM** (and some others depending on build).
3. Images are loaded and resized to a unified canvas size.
4. Use the keyboard to move through images:
   - `←` / `→` or `F` / `R` / `J` / `U`
5. Click **`Fit to Window`** to fit the image to the display area.

### 🔢 File Naming Rule

Images should be **sequentially numbered with the same number of digits**.

✅ Correct:
- `image0001.jpg`
- `image0002.jpg`
- `image0003.jpg`

❌ Problematic:
- `image1.jpg`
- `image2.jpg`
- `image10.jpg`
- `image11.jpg`

Inconsistent numbering will cause **incorrect sorting order** when loading images.

---

## 🎨 Canvas Background & Expansion

- Use **`Canvas BG Color`** to switch the background color:
  - White
  - Black
- Click **`Expand Canvas`** to add a **100 px margin on all sides** of every image.  
  This is useful when you need extra space for alignment adjustments.

---

## 🟡 Image Overlay

To visually align adjacent slices:

- **`Overlay Previous Image`**  
  Overlays the previous image with semi-transparency.

- **`Overlay Next Image`**  
  Overlays the next image with semi-transparency.

- **`Clear Overlay`**  
  Removes any overlaid image.

This helps visually confirm alignment between neighboring slices.

---

## 🎯 Position Adjustment (Image Alignment)

AlignRef is designed around **keyboard-based alignment**.

1. Click **`Start Recording Position`**.
2. Use the keyboard to move and rotate the current image:

   **Move**
   - Up / Down: `W`, `S`, `O`, `L`, `↑`, `↓`
   - Left / Right: `A`, `D`, `K`, `;`, `←`, `→`

   **Rotate**
   - Rotate left: `Q`, `I`
   - Rotate right: `E`, `P`

3. When you are satisfied with the alignment, click **`Finish Recording Position`**.
4. Set the range of images to apply this transform:

   - Go to the first frame of the range → click **`Set Position Start`**
   - Go to the last frame of the range → click **`Set Position End`**

5. Click **`Apply Position & Rotation`**  
   → The recorded transform will be applied to **all images** in the selected range.
6. If needed, click **`Cancel Applied Position`** to revert the operation.

---

## ✂️ Cropping (Batch ROI Trimming)

To remove unwanted surrounding areas from all images:

1. Click **`Start Crop`**.
2. Click two diagonal corners on the image to define a rectangle.  
   A **red box** will be displayed.
3. Click **`Apply Crop`** to crop **all images** using the same box.
4. Click **`Undo Crop`** to revert the cropping.
5. Click **`Clear Crop Box`** to remove only the red box (without cropping).

---

## 💾 Exporting Aligned Images

1. Choose **`Export Format`**:
   - JPG
   - PNG
   - BMP
   - TIFF
   - DICOM

2. Click **`Export Aligned Images`**.

AlignRef will create a new folder automatically, for example:

- `inputname_aligned_20251113_123456`

All processed images (after alignment/cropping) are exported to that folder.

---

## ⌨️ Keyboard Shortcuts

| Action          | Keys                             |
|-----------------|----------------------------------|
| Next image      | `→`, `F`, `J`, `PageDown`       |
| Previous image  | `←`, `R`, `U`, `PageUp`         |
| Zoom in/out     | `Ctrl + Mouse Wheel`            |
| Move up/down    | `W`, `S`, `O`, `L`, `↑`, `↓`    |
| Move left/right | `A`, `D`, `K`, `;`, `←`, `→`    |
| Rotate left     | `Q`, `I`                        |
| Rotate right    | `E`, `P`                        |

---

## 🧑‍🔬 Use Cases

- Alignment of serial histological or anatomical sections  
- Preprocessing image stacks before 3D reconstruction  
- Manual refinement of registration in research workflows  
- Simple batch cropping and export for clinical or educational figures

AlignRef is particularly useful as a **pre-processing step** before 3D reconstruction pipelines.

---

## 🧩 Development Notes

- Language: Python (PyQt-based), packaged as a standalone `.exe`
- Platform: Windows
- Repository: This GitHub repo hosts the **source code**, **issues**, and **documentation**.

Contributions, bug reports, and feature requests are welcome via **GitHub Issues**.

---

## Citation

If you use **AlignRef** in your academic work, please cite:

Satoru Muro, Takuya Ibara, Akimoto Nimura et al. Two-Step Workflow Integrating Automatic Registration and Manual Refinement for the Accurate Alignment of Serial Histological Sections in 3D Reconstruction, 09 December 2025, PREPRINT (Version 1) available at Research Square [https://doi.org/10.21203/rs.3.rs-8314237/v1]

