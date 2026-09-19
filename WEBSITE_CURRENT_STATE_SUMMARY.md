# AuRA Agri-Product Field Data Collector — Current Website & System State Summary

> **Document Purpose:** Complete, single-file technical and functional reference of the current AuRA Web Data Collection platform. Designed to provide instant, exhaustive context to AI assistants and development teams to guide architectural discussions, feature improvements, and solutions based on field visits to 10+ fertilizer and agro-input retail shops.

---

## 1. Executive Overview & Mission

* **Application Name:** AuRA Product Catalog Collector (`AuRA_Web_DATA`)
* **Primary Objective:** High-speed, standardized photographic and metadata collection of agro-chemical and input packaging (Fertilizers, Pesticides, Seeds) and background noise samples directly from retail agro-dealer shops in rural/semi-urban regions.
* **Downstream Consumers:** Offline Edge AI / Computer Vision models (object detection, label OCR, brand classification, fake/tamper detection, and false-positive rejection).
* **Target Users:** Field research teams, enumerators, and agronomists visiting retail fertilizer and agrochemical shops.
* **Core Tech Stack:**
  * **Frontend:** React 19, Vite 8, Lucide React (icons), Vanilla CSS design tokens (Plus Jakarta Sans & Outfit fonts).
  * **Image Processing:** Pure Client-side HTML5 Canvas resize & compression pipeline (`compressor.js`).
  * **Backend / API:** Google Apps Script (`backend/Code.gs`) deployed as a Web App (`doPost`/`doGet`).
  * **Storage & Database:** Google Drive API (nested product subfolders) + Google Sheets (`Field_Data_Master_Registry`).
  * **Deployment:** Vercel (Production / Preview) with `vercel.json` SPA rewrite rules.

---

## 2. High-Level Architecture & End-to-End Workflow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FIELD AGENT DEVICE                                   │
│                                                                                        │
│  [ Step 1: Category ] ──▶ [ Step 2: Packaging ] ──▶ [ Step 3: Product Details (Opt.) ] │
│  (Pesticide / Fert / Seed / Noise)   (Bottle / Pouch)   (Brand, Mfg, Pack, CIB, Cond.) │
│                                                                                        │
│  [ Step 4: Guided Angle Camera Capture ]                                               │
│    ├─ Live Camera (1080p, Switch Front/Rear) OR Device Gallery Upload                  │
│    ├─ Reticle Framing + Client-side Auto Crop to Bounding Box                          │
│    ├─ Audio/Haptic Shutter Sensory Feedback                                            │
│    ├─ Dynamic Angle Progression (1 to 5 angles or Rapid-Fire Noise)                    │
│    └─ In-browser Compression (~1600px JPEG, ~350-500KB, Base64 encoding)               │
│                                                                                        │
│  [ Review Summary Grid & Retake Options ]                                              │
│                                                                                        │
│  [ Sticky Submit Bar ] ──▶ Payload: JSON via HTTP POST (Content-Type: text/plain)      │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         │
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           GOOGLE APPS SCRIPT WEB APP BACKEND                           │
│                                 (backend/Code.gs)                                      │
│                                                                                        │
│  1. Parse POST JSON (text/plain avoids browser CORS preflight blocks)                  │
│  2. Idempotency Check: Verify if Folder / Submission ID exists                         │
│  3. Root Drive Folder: 11V6Coo-3MKs6ibvxqGfY4BXy8ZGPJf4I                               │
│  4. Create Unique Subfolder: "[Category] Product_Name - Mfg (YYYYMMDD_HHMMSS)"         │
│  5. Base64 Decode & Save Photo Files (Tagged with Angle & Submission ID)               │
│  6. Concurrency Lock: LockService.getScriptLock()                                      │
│  7. Master Sheet Logging: Append row to "Field_Data_Master_Registry" with Sanitization │
│  8. Return JSON Response { success: true, submissionId, folderUrl, folderName }        │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         │
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              OUTPUTS & CONFIRMATION                                    │
│  • Success Modal with direct Google Drive folder hyperlink                             │
│  • Session History counter in header                                                   │
│  • One-click reset to "Submit Next Product"                                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Taxonomy & Form State Specifications

### 3.1 Product Categories (`CATEGORIES` in `src/config.js`)
Every collection entry begins by selecting one category:
1. **Pesticide (`कीटकनाशक`)**: Chemical plant protection (insecticides, herbicides, fungicides).
2. **Fertilizer (`खते / पोषण`)**: Plant nutrients, chemical fertilizers (Urea, DAP, NPK), water-soluble fertilizers, micronutrients, biostimulants, soil conditioners.
3. **Seed (`बियाणे`)**: Hybrid & field crop seeds, vegetable packets.
4. **Not a Product — Noise (`नॉइज / निगेटिव्ह`)**: Negative training samples (empty racks, floor, hands holding items, clutter).

### 3.2 Packaging Types & Dynamic Angle Sequences (`PACKAGING_TYPES` in `src/config.js`)
Depending on packaging type, the required angle sequence dynamically reconfigures:

| Packaging Type | Target Items | Sequence of Angles |
| :--- | :--- | :--- |
| **Bottle / Container** (`बाटली / कंटेनर`) | Plastic/glass bottles, cans, jerry cans, drums | 1. **Front Side** (Main label, brand name, active ingredients)<br>2. **Right Side** (Dosage info, toxicity triangle)<br>3. **Left Side** (Cautions, manufacturer details)<br>4. **Back Side** (Composition, batch, MRP, Mfg/Exp dates)<br>5. **Barcode / QR** (Close-up, high-contrast) *(Optional)* |
| **Pouch / Packet** (`पाऊच / पाकीट`) | Seed packets, powder sachets, fertilizer granule pouches | 1. **Front Side** (Brand, crop type, hybrid variety, net weight)<br>2. **Back Side** (Sowing instructions, germination %, batch, dates, MRP)<br>3. **Barcode / QR** (Close-up if present) *(Optional)* |

*Note:* Each angle can be individually skipped if not applicable to the package.

### 3.3 Product Metadata Fields (`src/App.jsx`)
* **Product Brand Name:** Text input (e.g., `Coromandel Gromor 28-28-0`, `Urea 46% N`, `Bayer Confidor`).
* **Manufacturer:** Text input (e.g., `Bayer`, `UPL`, `IFFCO`, `Coromandel`, `KRIBHCO`, `Mahyco`).
* **Pack Size:** Text input (e.g., `250ml`, `500ml`, `1kg`, `5kg`, `50kg bag`).
* **Registration / CIB No.:** Text input (e.g., `CIR-18239/2018` or Fertilizer Control Order `FCO/Lic No`).
* **Packaging Physical Condition:** 4 Selectable Pills:
  * `New / Clean`: Fresh stock, crisp label.
  * `Dusty / Aged`: Typical fertilizer shop dust, warehouse wear.
  * `Sun Faded`: Discolored print from UV exposure on shop shelves.
  * `Damaged / Torn`: Torn bag/label, dented bottle/can.
* **Notes / Additional Info:** Optional free-form text input.
* **Validation Rule:** *Zero mandatory text fields!* The form submits successfully even if metadata is blank, as long as **at least 1 photo** is present. Fallback naming automatically populates `[Category] Sample` or `Noise Negative Sample`.

### 3.4 Noise / Negative Mode
* When the user clicks **"Not a Product — Noise"**, packaging and product metadata fields hide.
* **Noise Quick Tags:** Fast one-tap chips:
  * `Empty shelf / shop rack`
  * `Hand holding an item`
  * `Blurry / motion blur photo`
  * `Unrelated object (tool, bottle, carton)`
  * `Store counter / floor / wall`
  * `Off-catalog non-agri product`
  * `Shadow / extreme glare`
* **Rapid-Fire Capture:** Camera stays continuously open in rapid-fire mode so users can take 5–15 background photos in seconds without leaving the viewfinder.

---

## 4. Hardware Camera & Photo Engine (`src/components/GuidedCameraCapture.jsx`)

### 4.1 State Machine
The camera operates on a strict, predictable state machine:
* `idle`: Initial ready screen presenting exactly two prominent buttons: **Open Camera** and **Upload**.
* `live`: Hardware camera stream active via `navigator.mediaDevices.getUserMedia` with video viewfinder, target bounding box reticle, and shutter button.
* `error`: Graceful fallback if camera permission was denied, device lacks a camera, or context is insecure (HTTP). Provides single-click Upload alternative and Retry button.
* `captured`: Review mode for the current angle with image preview, file size tag, **Retake Photo**, and **Next Angle**.
* `summary`: Grid view showing all angles side-by-side with individual retake triggers before final submission.

### 4.2 Key Camera Features
1. **Resolution & Constraints:** Requests `1080p` ideal (`1920x1080`), fallback to device default if constrained.
2. **Facing Mode Switching:** Defaults to back camera (`environment`), with a 1-tap **Flip** button to switch to front camera (`user`).
3. **Target Reticle & Viewfinder Crop:**
   * A green framing rectangle overlay guides the user to center the bottle or pouch.
   * On snapshot, mathematics inside `handleSnapPhoto` calculate the rendered aspect ratio vs intrinsic stream dimensions and crop the canvas output directly to the reticle boundaries.
4. **Sensory Feedback:**
   * **Mobile Haptic:** Triggers `navigator.vibrate([40, 25, 55])`.
   * **Audio Click:** Synthesized mechanical camera shutter sound using HTML5 Web Audio API oscillators (no external mp3 file required).
5. **Testing & Automation Mocks:**
   * Query param `?mockCamera=1`: Simulates an animated canvas stream with a rendered fertilizer bottle and barcode.
   * Query params `?testState=error`, `?testState=captured`, `?testState=noise`: Instant state inspection for testing without physical devices.

---

## 5. Client-Side Image Compression Pipeline (`src/utils/compressor.js`)

* **Problem Solved:** High-resolution mobile phone photos are 5MB–12MB each. Uploading 5 angles over 3G/4G rural networks takes 30–60 seconds or times out Google Apps Script execution limits.
* **Solution:**
  * Uses `FileReader` + HTML5 `Image` + Off-screen `Canvas`.
  * Downscales dimensions proportionally to a max dimension of **1600px**.
  * Encodes to **JPEG at 0.82 quality**.
  * Slashing payload size by **85%–92%** (typical compressed size: **350KB – 550KB**).
  * Barcodes, chemical formulas, and fine MRP print remain tack-sharp for AI training and OCR.
  * Outputs metadata: `originalSize`, `compressedSize`, `width`, `height`, `base64`.

---

## 6. Backend Integration & Data Destination (`backend/Code.gs`)

### 6.1 Google Drive Structure
* **Root Folder ID:** `11V6Coo-3MKs6ibvxqGfY4BXy8ZGPJf4I`
* **Subfolder Naming Conventions:**
  * Product: `[Category] ProductName - Manufacturer (YYYYMMDD_HHMMSS)`
  * Noise: `[NOISE] Description (YYYYMMDD_HHMMSS)`
* **File Naming Conventions:**
  * `${submissionId}_${angleTag}.jpg` (e.g., `SUB_20260919_103000_123_Front.jpg`).
  * File description metadata set on each Drive file with product, packaging, and angle tags.

### 6.2 Master Google Sheet Registry (`Field_Data_Master_Registry`)
Stored inside the root Google Drive folder. Every submission appends a row with 13 columns:
1. `Submission ID`
2. `Timestamp (IST)`
3. `Category`
4. `Packaging Type`
5. `Product Name`
6. `Manufacturer`
7. `Reg / Cert No`
8. `Pack Size`
9. `Condition`
10. `Angles Captured`
11. `Photo Count`
12. `Drive Folder Link` (Direct clickable URL)
13. `Notes`

### 6.3 Backend Reliability & Security Features
* **Script Locking:** Uses `LockService.getScriptLock()` (up to 20 seconds wait) to serialize row writing and prevent race conditions when multiple agents upload concurrently.
* **CSV/Formula Injection Protection:** `sanitizeCell()` prepends an apostrophe `'` to any value starting with `=`, `+`, `-`, or `@`.
* **CORS Preflight Bypass:** HTTP POST uses `Content-Type: text/plain;charset=utf-8` to prevent browser preflight `OPTIONS` blocks on Google Apps Script endpoints.
* **Idempotency:** Reuses client-generated `submissionId` across retries; detects existing folders to avoid duplicate file creation.
* **Rollback Protection:** If file writing fails mid-way, newly created empty folders are automatically trashed.

---

## 7. Field Guidelines & User Manual (`src/components/UserManualModal.jsx`)

Accessible via the **Guidelines** button in the header and camera view:
1. **Golden 4-Point Checklist:**
   * **Good Lighting:** Avoid dark shadows; use natural or shop tube light.
   * **No Glare:** Tilt bottle slightly away from overhead bulbs to keep shiny plastic labels legible.
   * **Text in Focus:** Tap screen to lock focus on fine print and batch codes.
   * **Hold Steady:** Prevent hand motion blur.
2. **Tabbed Manual:**
   * **5 Required Angles:** Explanations and Marathi translations (`पुढील बाजू`, `साइड पॅनेल`, `झाकण आणि सील`, `बारकोड व क्यूआर कोड`, `मागील बाजू`).
   * **Do's & Don'ts:** Clean counter, flat pouch, correct lighting vs fingers over text, crumpled packets, dark corners.
   * **Noise Guidelines:** Instructions on capturing background negatives.

---

## 8. File & Folder Manifest

```
AuRA_Web_DATA/
├── index.html                      # HTML5 entry, Google Fonts preconnect, mobile meta tags
├── package.json                    # React 19, Vite, Lucide-React, Oxlint
├── vite.config.js                  # Vite configuration
├── vercel.json                     # SPA routing rewrite rules for Vercel
├── .env.local                      # Local deployment environment config
├── backend/
│   └── Code.gs                     # Google Apps Script Web App source code
├── src/
│   ├── main.jsx                    # React root mount
│   ├── index.css                   # Global CSS design tokens, typography, surfaces, variables
│   ├── App.jsx                     # Core application orchestrator, forms, submit workflow, modals
│   ├── App.css                     # Comprehensive UI stylesheet, responsive layout, animations
│   ├── config.js                   # Categories, packaging types, photo angles, noise types, API endpoint
│   ├── components/
│   │   ├── GuidedCameraCapture.jsx # 5-angle sequential camera state machine, viewfinder, reticle crop
│   │   └── UserManualModal.jsx     # Bilingual (English/Marathi) photographic manual modal
│   └── utils/
│       └── compressor.js           # Client-side canvas resize, compression & base64 formatting
```

---

## 9. Key Findings from Fertilizer Shop Visits & Opportunities for Improvement

*(This section sets the stage for the team's new findings from visiting 10+ fertilizer retail stores)*

Based on real-world Indian agro-dealer environments (Krishi Seva Kendras / fertilizer shops), common realities to incorporate include:
1. **Fertilizer Bag Specifics (50kg / 25kg / 5kg HDPE / BOPP bags):**
   * Unlike small pesticide bottles, fertilizer bags are heavy, stacked horizontally in piles, dusty, or stitching-tagged.
   * Packaging needs dedicated support for **Bags / Sacks (गोणी / पिशवी)** with specific angles (e.g., Front Bag Face, Nitrogen/Phosphorus/Potash NPK Grade ratio print, Stitched Tag / Bag Seal, Govt MRP & Subsidy mandatory declaration).
2. **Shopkeeper & Location Context:**
   * Shop name, taluka/district/state, or GPS coordinates.
   * Wholesale vs Retail distinction.
3. **Fertilizer Brand Variations & Government Subsidized Declarations:**
   * Neem-coated Urea, DAP (18-46-0), MOP (0-0-60), Complex Fertilizers (10-26-26, 12-32-16, 20-20-0-13), Water-Soluble Fertilizers (19-19-19, 0-52-34), Bio-fertilizers, Micronutrients (Zinc, Boron, Ferrous, Sulphur).
   * Often dealers sell local or regional brands alongside major brands (IFFCO, KRIBHCO, Coromandel, RCF, NFL, Deepak Fertilisers, Zuari, Mahadhan).
4. **Lighting & Shelf Conditions:**
   * Godowns and back storage rooms often have dim lighting, yellow incandescent bulbs, or high glare on glossy laminated packets.
   * Flash/torch toggle, exposure slider, or live sharpness checks.
5. **Batch / Expiry / MRP Capture:**
   * In fertilizers, MRP print is frequently stamped or inkjet-printed on the side seam or top stitch, often smudged by handling.
6. **Speed & Offline Capability:**
   * Field agents entering shops with poor internet need fast local queueing / offline caching (PWA / IndexedDB) so they can snap 20 products and sync when back on 4G/Wi-Fi.
7. **Live Barcode / QR Scanner Integration:**
   * Direct barcode scanning (via BarcodeDetector API / ZXing) to auto-fill brand or registration info.

---

## 10. Summary Quick Reference for AI Prompting

When prompting an AI to build new features, provide fixes, or adjust workflows on this repository:
* Refer to **`src/config.js`** for categories, packaging types, and angle definitions.
* Refer to **`src/App.jsx`** for top-level form state, submission lifecycle, and recent history.
* Refer to **`src/components/GuidedCameraCapture.jsx`** for camera hardware interactions, viewfinder cropping, and step progression.
* Refer to **`src/utils/compressor.js`** for image resizing limits and byte formatting.
* Refer to **`backend/Code.gs`** for Google Drive folder organization, Google Sheets schema, and server-side handling.
