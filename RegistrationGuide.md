# Registration Guide for Serial Histological Sections (MultiStackReg + AlignRef)

This page provides a complete guide for **automatic registration (alignment)** of serial histological sections prior to segmentation.
AlignRef is designed to be used **after** initial automatic registration (e.g., using MultiStackReg), for fine-tuning alignment across the sequence.

---

# 🔍 Why Registration is Necessary for Serial Sections

In histological serial sections, **registration must be performed before segmentation**.
First, automatic alignment is performed using MultiStackReg, and afterward, fine adjustments can be made using AlignRef.

---

# 🧰 What is MultiStackReg?

MultiStackReg is a plugin for ImageJ/Fiji that performs automatic registration of serially sectioned images.

📎 GitHub: [https://github.com/miura/MultiStackRegistration](https://github.com/miura/MultiStackRegistration)

---

# 🎥 Demo Videos (YouTube)

### **📌 ImageJ/Fiji Tutorial: Registration of Histological Serial Sections using MultiStackReg**

[https://youtu.be/bWF2HW5yjOI](https://youtu.be/bWF2HW5yjOI)

<a href="https://youtu.be/bWF2HW5yjOI">
  <img src="https://github.com/SatoruMuro/SAM2GUIfor3Drecon/blob/main/images/watchvideoicon1.png" width="110">
</a>

### **📌 ImageJ/Fiji Tutorial: How to Easily Crop an Image Sequence**

[https://youtu.be/Rx8TdUN40ig](https://youtu.be/Rx8TdUN40ig)

<a href="https://youtu.be/Rx8TdUN40ig">
  <img src="https://github.com/SatoruMuro/SAM2GUIfor3Drecon/blob/main/images/watchvideoicon1.png" width="110">
</a>

---

# 📥 Downloading Fiji (Enhanced ImageJ)

Fiji is a distribution of ImageJ containing many pre-installed plugins.

🔗 **Download page:** [https://fiji.sc/](https://fiji.sc/)

### ✔ Installation Steps

1. Download Fiji and unzip it.
2. Place the resulting **Fiji.app** folder directly under the C drive (recommended).
3. On Windows, launch `ImageJ-win64.exe`.
4. Pin it to the taskbar for quick access.

---

# 🔧 Installing MultiStackReg and TurboReg

MultiStackReg requires TurboReg to function properly.

<img src="https://github.com/SatoruMuro/SAM2GUIfor3Drecon/blob/main/images/MultiStackRegInstall.png" width="70%">

### ✔ How to Install

1. Launch Fiji → **Help > Update...**
2. When the *ImageJ Updater* window appears, click **Manage Update Sites**.
3. In the search field, type **"multistackreg"** → check the box.
4. TurboReg is included in **BIG-EPFL**, so search for **"BIG-EPFL"** and check it.
5. Click **Apply and Close** → **Apply Changes**.
6. Restart Fiji to complete installation.

### ✔ Verification

Go to `Plugins > Registration` and confirm:

* MultiStackReg
* TurboReg

Both should be listed.

---

# 🔄 Registration Procedure (MultiStackReg)

### ✔ Preparation

1. Gather all serial section images into one folder.
2. Make sure filenames are **numeric and zero-padded** (e.g., image0001.jpg).

### ✔ Step 1: Import Image Sequence

1. Fiji → **File > Import > Image Sequence...**
2. Select the folder containing the images.
3. Ensure **Sort names numerically** is checked.

### ✔ Step 2: Split RGB Channels

MultiStackReg cannot operate on color images directly.
Split into separate RGB channels:

* **Image > Color > Split Channels**
* Three stacks will be created: (red), (green), (blue)

<img src="https://github.com/SatoruMuro/SAM2GUIfor3Drecon/blob/main/images/MultiStackReg.png" width="70%">

### ✔ Step 3: Run MultiStackReg on the Blue Channel

1. Plugins > Registration > **MultiStackReg**
2. **Stack 1** → select (blue)
3. **Action 1:** Align
4. **Transformation:** Rigid Body
5. Check **Save Transformation File**
6. Execute (OK)

A transformation file (e.g., *TransformationMatrices.txt*) will be created.

### ✔ Step 4: Apply the Same Transformation to Green and Red Channels

For each remaining channel:

1. Open MultiStackReg again
2. Stack 1 → select (green) or (red)
3. Action 1 → **Load Transformation File**
4. Select the previously saved file

Both (green) and (red) stacks will now be aligned identically to (blue).

---

# 🔄 Merge RGB Channels Back

1. **Image > Color > Merge Channels**
2. Set: C1(red) → (red), C2(green) → (green), C3(blue) → (blue)
3. Uncheck **Create composite**
4. Check **Keep source images**
5. OK → A registered RGB image stack will be created.

---

# 💾 Saving the Registered Sequence

File → **Save As > Image Sequence...**

* Format: JPEG, PNG, etc.
* Name: e.g., "image"
* Start At: 1
* Digits: 3–4

Registration is complete.
Well done!

---

# 📚 Citing MultiStackReg in Research

If you use MultiStackReg in published work, you **must cite or acknowledge it**.

Details:
[https://github.com/miura/MultiStackRegistration](https://github.com/miura/MultiStackRegistration)

---

# 🧩 AlignRef for Fine Adjustment After Registration

Even after performing automatic registration with MultiStackReg, you may still find:

* Slight misalignment between slices
* Tilted sections
* Artifacts affecting segmentation quality

For these cases, **AlignRef** allows manual fine-tuning:

✔ Keyboard-based translation & rotation
✔ Overlay comparison with previous/next images
✔ Batch application across selected frames
✔ Batch cropping capability

🔗 **[AlignRef User Guide (English)](https://github.com/SatoruMuro/AlignRef/blob/main/README.md)**

---
