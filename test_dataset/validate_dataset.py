"""
Standalone Test Dataset Validator & Baseline Runner.
Evaluates the imported test dataset against the current LargeNet model WITHOUT training.
"""
import sys
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.ml.waste_classifier import WasteClassifier

def main():
    print("=" * 80)
    print("   AMC WasteOptimizer — Test Dataset Validation & Model Baseline (No Training)   ")
    print("=" * 80)

    manifest_path = Path(__file__).resolve().parent / "dataset_manifest.json"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    print(f"Dataset: {manifest['dataset_name']}")
    print(f"Total Test Images: {manifest['total_images']}")
    print(f"Categories: {', '.join(manifest['categories'])}\n")

    classifier = WasteClassifier()
    correct = 0
    total = len(manifest["items"])

    print(f"{'Image File':<36} {'True Label':<12} {'Predicted':<12} {'Confidence':<10} {'Status'}")
    print("-" * 80)

    for item in manifest["items"]:
        img_path = Path(__file__).resolve().parent / item["filename"]
        if not img_path.exists():
            continue
            
        with open(img_path, "rb") as f:
            data = f.read()
            
        res = classifier.classify(data)
        pred_cat = res["category"].lower()
        true_cat = item["category"].lower()
        
        # Mappings check (biological -> Organic, battery/cardboard -> Other)
        is_match = (pred_cat == true_cat) or \
                   (true_cat == "organic" and pred_cat == "organic") or \
                   (true_cat in ["battery", "cardboard"] and res["category"] == "Other") or \
                   (true_cat == "cardboard" and pred_cat in ["cardboard", "paper", "other"])

        if is_match:
            correct += 1
            status = "[MATCH]"
        else:
            status = "[DIFF]"

        print(f"{item['filename'][:34]:<36} {true_cat:<12} {res['category']:<12} {res['confidence']*100:>5.1f}%     {status}")

    print("-" * 80)
    print(f"Baseline Pre-Trained Test Match Rate: {correct}/{total} ({correct/total*100:.1f}%)")
    print("Note: The model has NOT been trained or modified.")

if __name__ == "__main__":
    main()
