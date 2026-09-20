"""
Waste image classifier — uses a LargeNet CNN (~1.1 MB) trained on 7 waste
categories.  Runs entirely on CPU with zero cloud dependency.
Maps the model's 7 output classes to 6 project categories.
"""
import io
import json
import os

import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torchvision import transforms

# ---------------------------------------------------------------------------
# Singleton instance
# ---------------------------------------------------------------------------
_classifier = None

# ---------------------------------------------------------------------------
# LargeNet architecture (must match the checkpoint that ships with the repo)
# ---------------------------------------------------------------------------

class LargeNet(nn.Module):
    def __init__(self):
        super(LargeNet, self).__init__()
        self.name = "large"
        self.conv1 = nn.Conv2d(3, 5, 5)
        self.pool = nn.MaxPool2d(2, 2)
        self.conv2 = nn.Conv2d(5, 10, 5)
        self.fc1 = nn.Linear(10 * 29 * 29, 32)
        self.fc2 = nn.Linear(32, 7)

    def forward(self, x):
        x = self.pool(F.relu(self.conv1(x)))
        x = self.pool(F.relu(self.conv2(x)))
        x = x.view(-1, 10 * 29 * 29)
        x = F.relu(self.fc1(x))
        x = self.fc2(x)
        x = x.squeeze(1)  # Flatten to [batch_size]
        return x


# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------

MODEL_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "models",
    "waste_classifier",
)

CONFIG_PATH = os.path.join(MODEL_DIR, "config.json")
WEIGHTS_PATH = os.path.join(MODEL_DIR, "pytorch_model.bin")

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


# ---------------------------------------------------------------------------
# Classifier wrapper
# ---------------------------------------------------------------------------

class WasteClassifier:
    """
    Loads the LargeNet CNN model and provides a classify(image_bytes) method.

    - Architecture: LargeNet (2-conv + 2-FC, ~1.1 MB)
    - Input: 128×128 RGB, normalised to [-1, 1]
    - Output: 7-class softmax → mapped to 6 project categories
    - Runs on CPU; no GPU required
    """

    def __init__(self):
        self.device = torch.device("cpu")

        # Load config for class names and preprocessing params
        with open(CONFIG_PATH, "r") as f:
            config = json.load(f)

        self.class_names = config["class_names"]
        mean = config["normalization"]["mean"]
        std = config["normalization"]["std"]
        input_size = tuple(config["input_size"])  # (128, 128)

        # Build model and load trained weights
        self.model = LargeNet()
        state_dict = torch.load(WEIGHTS_PATH, map_location=self.device, weights_only=True)
        self.model.load_state_dict(state_dict)
        self.model.to(self.device)
        self.model.eval()

        # Preprocessing pipeline matching training config
        self.transform = transforms.Compose([
            transforms.Resize(input_size),
            transforms.ToTensor(),
            transforms.Normalize(mean, std),
        ])

    def classify(self, image_bytes: bytes) -> dict:
        """
        Classify an image and return the project category + confidence.

        Returns:
            {"category": str, "confidence": float, "model_class": str,
             "all_probabilities": dict, "model_name": str}
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
            "model_name": "LargeNet CNN",
        }


def get_classifier() -> WasteClassifier:
    """Return a singleton WasteClassifier instance (lazy-loaded)."""
    global _classifier
    if _classifier is None:
        _classifier = WasteClassifier()
    return _classifier
