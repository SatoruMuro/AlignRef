# 位置合わせ修正ツール AlignRef の使い方（日本語）

---

> 🌐 **English version available here:**
> [README.md](https://github.com/SatoruMuro/AlignRef/blob/main/README.md)  

## ✔ 日本語版（README 用）

**AlignRef** は、連続画像（組織連続切片、CT/MRI スライス、連続写真など）の  
**位置合わせや前処理をインタラクティブに行うための軽量デスクトップアプリ**です。

### 主な機能
- キーボードによる位置（平行移動）・回転の精密調整  
- 前後画像を半透明で表示するオーバーレイ機能  
- 共通の ROI を使った一括クロップ  
- JPG/PNG/BMP/TIFF/DICOM 形式への一括エクスポート  
- インストール不要の **単体 Windows 実行ファイル（.exe）** として提供

> 🧪 解剖学・形態学研究のワークフローを想定して設計されていますが、  
> **あらゆる画像処理プロジェクトで利用できます。**



---

> **重要 — AlignRef を使う前に**
> 
> AlignRef は、MultiStackReg などで **自動位置合わせを行った後に使う微調整ツール**です。  
> 組織連続切片を扱う場合は、まず ImageJ/Fiji + MultiStackReg により  
> **自動位置合わせ（Registration）**を行ってください。
> 
> 👉 **位置合わせガイド（英語 / English）**  
> https://github.com/SatoruMuro/AlignRef/blob/main/RegistrationGuide.md
> 
> 👉 **位置合わせガイド（日本語）**  
> https://github.com/SatoruMuro/AlignRef/blob/main/RegistrationGuide_JP.md

---

## 📦 アプリのダウンロードと起動

1. 以下のリンクから `AlignRef.zip` をダウンロードしてください
   👉 [AlignRef.zip を Dropbox からダウンロード](https://www.dropbox.com/scl/fi/dggt20l4g0w8cgq097i35/AlignRef.zip?rlkey=fck23rub5t2edgyxcn0ycnvpq&st=hb6skgpf&dl=1)

※ ファイルサイズが大きいため、GitHub ではなく Dropbox 経由での配布となっています。

2. ダウンロードした zip を解凍し、`AlignRef.exe` と `_internal` フォルダが含まれているフォルダを
   `C:\AlignRef\` のように **Cドライブ直下に配置してください。**

> ❗ デスクトップやドキュメントなど、**日本語・空白・長いパス**を含む場所に置くと、実行時にエラーが発生する可能性があります。

3. `AlignRef.exe` をダブルクリックして起動します。

> ⚠️ Windows SmartScreen で警告が出た場合
> 「詳細情報」→「実行」を選択してください。
> ❗ `_internal` フォルダは実行に必要です。削除しないでください。

---

## 🖼️ 画像の読み込みと表示

1. `Load Image Folder` をクリックして画像フォルダを選択
2. JPG/PNG/TIFF/DICOM などの画像が読み込まれ、統一サイズのキャンバスに配置されます
3. `←`, `→` または `F`/`R`/`J`/`U` キーで前後の画像に切り替え
4. `Fit to Window` で画像を画面にフィット表示

### 💡 画像ファイル名の注意

画像は **連番 + 同じ桁数** で命名する必要があります。

* ✅ `image0001.jpg`, `image0002.jpg`, `image0003.jpg`
* ❌ `image1.jpg`, `image2.jpg`, `image10.jpg`

桁数が揃っていないと、読み込み時の並び順が正しく認識されません。

---

## 🎨 キャンバス背景の設定と拡張

* `Canvas BG Color`：背景色（White / Black）
* `Expand Canvas`：全画像の上下左右に **100px の余白を追加**

---

## 🟡 画像の重ね合わせ（オーバーレイ）

* `Overlay Previous Image`：1つ前の画像を半透明で重ねる
* `Overlay Next Image`：1つ後の画像を半透明で重ねる
* `Clear Overlay`：オーバーレイを消去

---

## 🎯 位置の調整（位置合わせ）

1. `Start Recording Position` を押す

2. キーボードで画像を移動・回転：

   **移動**

   * 上下：`W`, `S`, `O`, `L`, `↑`, `↓`
   * 左右：`A`, `D`, `K`, `;`, `←`, `→`

   **回転**

   * 左回転：`Q`, `I`
   * 右回転：`E`, `P`

3. 終わったら `Finish Recording Position`

4. 適用範囲を指定：

   * 開始フレーム → `Set Position Start`
   * 終了フレーム → `Set Position End`

5. `Apply Position & Rotation` で一括適用

6. `Cancel Applied Position` で取り消し可能

---

## ✂️ クロップ（不要部分の切り取り）

1. `Start Crop` を押して、画像上の対角2点をクリック
2. 赤枠が表示される
3. `Apply Crop` で全画像に同じ範囲でクロップ
4. `Undo Crop` で元に戻す
5. `Clear Crop Box` で赤枠だけ消去

---

## 💾 画像の書き出し（エクスポート）

1. `Export Format`（JPG, PNG, BMP, TIFF, DICOM）を選択
2. `Export Aligned Images` を押すと一括保存

保存先フォルダ例：

```
inputname_aligned_20251113_123456
```

---

## ⌨️ ショートカットキーまとめ

| 操作   | キー                           |
| ---- | ---------------------------- |
| 次の画像 | `→`, `F`, `J`, `PageDown`    |
| 前の画像 | `←`, `R`, `U`, `PageUp`      |
| 拡大縮小 | `Ctrl + マウスホイール`             |
| 上下移動 | `W`, `S`, `O`, `L`, `↑`, `↓` |
| 左右移動 | `A`, `D`, `K`, `;`, `←`, `→` |
| 左回転  | `Q`, `I`                     |
| 右回転  | `E`, `P`                     |

---

## 🧑‍🔬 本アプリの用途

* 連続切片の位置合わせ
* 3D再構築前の前処理
* 手動調整を含む画像アライメント
* 研究・教育用途での一括クロップ / 一括変換

---
