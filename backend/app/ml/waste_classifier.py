"""
Waste image classifier — wraps the LargeNet model from backend/models/waste_classifier/.
Maps the model's 7 output classes to 6 project categories.
"""
import io
import os
import json
import torch
from PIL import Image
from torchvision import transforms

# Singleton instance
_classifier = None

# Mapping from model's 7 classes to project's 6 categories
MODEL_TO_PROJECT_CATEGORY = {
    "plastic": "Plastic",
    "paper": "Paper",
    "metal": "Metal",
    "glass": "Glass",
    "biological": "Organic",
    "battery": "Other",
    "cardboard": "Other",
}

MODEL_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "models",
    "waste_classifier",
)


class WasteClassifier:
    """Loads the LargeNet model once and provides a classify(image_bytes) method."""

    def __init__(self, model_dir: str = MODEL_DIR):
        # Load config
        config_path = os.path.join(model_dir, "config.json")
        with open(config_path, "r") as f:
            self.config = json.load(f)

        # Use CPU: 1.1MB model runs in <5ms on CPU and avoids CUDA version mismatches
        self.device = torch.device("cpu")
        self.class_names = self.config["class_names"]

        # Load model architecture + weights
        import sys
        sys.path.insert(0, model_dir)
        from model import load_model  # noqa: E402
        model_path = os.path.join(model_dir, "pytorch_model.bin")
        self.model = load_model(model_path, self.device)

        # Build transform pipeline
        mean = self.config["normalization"]["mean"]
        std = self.config["normalization"]["std"]
        size = tuple(self.config["input_size"])  # (128, 128)
        self.transform = transforms.Compose([
            transforms.Resize(size),
            transforms.ToTensor(),
            transforms.Normalize(mean, std),
        ])

    def classify(self, image_bytes: bytes) -> dict:
        """
        Classify an image and return the project category + confidence.

        Returns:
            {"category": str, "confidence": float, "model_class": str,
             "all_probabilities": dict}
        """
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = self.transform(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            outputs = self.model(tensor)
            probabilities = torch.nn.functional.softmax(outputs, dim=1)
            confidence, predicted = torch.max(probabilities, 1)

        model_class = self.class_names[predicted.item()]
        project_category = MODEL_TO_PROJECT_CATEGORY.get(model_class, "Other")
        conf = round(confidence.item(), 4)

        all_probs = {
            self.class_names[i]: round(probabilities[0][i].item(), 4)
            for i in range(len(self.class_names))
        }

        return {
            "category": project_category,
            "confidence": conf,
            "model_class": model_class,
            "all_probabilities": all_probs,
        }


def get_classifier() -> WasteClassifier:
    """Return a singleton WasteClassifier instance (lazy-loaded)."""
    global _classifier
    if _classifier is None:
        _classifier = WasteClassifier()
    return _classifier
