# 🧪 AMC WasteOptimizer — Testing Dataset & Telemetry Suite

A curated, secure, virus-free testing dataset for the **Ahmedabad Municipal Corporation (AMC)** Waste & Recycling Intelligence Platform.

> [!IMPORTANT]
> **Zero-Training Guarantee**: As explicitly requested, **NO models were trained or modified**. This directory contains purely imported test artifacts, ground-truth image samples, and paired IoT telemetry data for manual and automated verification.

---

## 📁 Directory Structure

```
test_dataset/
├── dataset_manifest.json          # Complete JSON registry of all 105 images, SHA256 hashes & metadata
├── README.md                      # Documentation, provenance & test instructions
├── validate_dataset.py            # Automated runner to test all images against the current model
├── images/                        # 105 High-quality test images organized by class
│   ├── plastic/                   # 15 test samples (bottles, containers, cups)
│   ├── paper/                     # 15 test samples (newspapers, sheets, envelopes)
│   ├── metal/                     # 15 test samples (soda cans, tin food cans, foil)
│   ├── glass/                     # 15 test samples (clear bottles, green glass, jars)
│   ├── cardboard/                 # 15 test samples (shipping boxes, corrugated board)
│   ├── organic/                   # 15 real test samples (food waste, fruit peels, biological)
│   └── battery/                   # 15 real test samples (household AA, AAA, 9V, coin cells)
└── telemetry/                     # Paired AMC IoT sensor telemetry
    ├── amc_bins_test_telemetry.json  # 2,016 hourly sensor readings across 12 AMC bins (7 days)
    ├── amc_bins_test_telemetry.csv   # CSV format for Pandas/Excel analysis
    └── anomaly_scenarios.json        # 4 targeted edge-case anomaly testing scenarios
```

---

## 🔒 Source Provenance & Security Verification

All files are imported directly over HTTPS from verified, authentic open repositories:
1. **Stanford TrashNet Dataset**:
   - Source: **Hugging Face Official Repository** (`garythung/trashnet`)
   - Original Authors: Gary Thung, MingSheng Yang (Stanford University)
   - Integrity: Raw `.jpg` images extracted directly from authenticated repository `dataset-resized.zip`.
2. **Waste & Garbage Management Dataset**:
   - Source: **Hugging Face Official Repository** (`kdkd1/waste-garbage-management-dataset`)
   - Provides real photographic samples for `biological` (organic) and `battery`.
3. **Security**:
   - Zero executables, zero DLLs, zero macro-enabled files. Pure JPEG media files and plaintext JSON/CSV data.
   - SHA256 checksum recorded for every single image in `dataset_manifest.json`.

---

## 🚀 How to Test

### 1. Manual Testing via Web Dashboard
1. Open the web app at `http://localhost:5173`.
2. Navigate to **Classify Waste** in the sidebar.
3. Open `test_dataset/images/` in File Explorer.
4. Drag and drop any image into the upload bay.
5. Watch the real-time LargeNet CNN infer the material class and softmax probability breakdown!

### 2. Automated Baseline Validation
Run the test validator from the command line:
```powershell
python test_dataset/validate_dataset.py
```
This runs every image through the inference engine and prints the classification results without altering model weights.

### 3. Telemetry Testing
Inspect `test_dataset/telemetry/amc_bins_test_telemetry.json` for 7 days of realistic ultrasonic fill data across AMC zones (*Navrangpura, Bodakdev, Satellite, Khadia/Riverfront, Bapunagar/Nikol*).
