"""
Waste image classifier — uses a pretrained ResNet-18 backbone (ImageNet weights)
with a fine-tuned 7-class head for waste category prediction.
Maps the model's 7 output classes to 6 project categories.
"""
import io
import os
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms, models

# Singleton instance
_classifier = None

# The 7 waste class names (matches original training label order)
CLASS_NAMES = [
    "battery",
    "biological",
    "cardboard",
    "glass",
    "metal",
    "paper",
    "plastic",
]

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

# Path to fine-tuned ResNet-18 weights (if available); falls back to ImageNet pretrained
RESNET_WEIGHTS_PATH = os.path.join(MODEL_DIR, "resnet18_waste.pth")


def build_resnet18(num_classes: int = 7, pretrained: bool = True) -> nn.Module:
    """
    Build a ResNet-18 model with a replaced final FC layer for num_classes outputs.
    Uses pretrained ImageNet weights for the backbone.
    """
    weights = models.ResNet18_Weights.IMAGENET1K_V1 if pretrained else None
    model = models.resnet18(weights=weights)
    # Replace the final fully-connected layer to output num_classes
    in_features = model.fc.in_features
    model.fc = nn.Linear(in_features, num_classes)
    return model


class WasteClassifier:
    """
    Loads a ResNet-18 model and provides a classify(image_bytes) method.

    - Backbone: ResNet-18 pretrained on ImageNet (torchvision)
    - Head: Linear(512 → 7) for waste category classification
    - If a fine-tuned checkpoint exists at models/waste_classifier/resnet18_waste.pth,
      it will be loaded automatically; otherwise ImageNet pretrained weights are used.
    """

    def __init__(self):
        self.device = torch.device("cpu")
        self.class_names = CLASS_NAMES

        # Build ResNet-18 with 7-class head
        self.model = build_resnet18(num_classes=len(CLASS_NAMES), pretrained=True)

        # Load fine-tuned weights if they exist
        if os.path.exists(RESNET_WEIGHTS_PATH):
            state_dict = torch.load(RESNET_WEIGHTS_PATH, map_location=self.device)
            self.model.load_state_dict(state_dict)

        self.model.to(self.device)
        self.model.eval()

        # ResNet-18 standard transform: 224×224, ImageNet normalization
        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
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
            "model_name": "ResNet-18",
        }


def get_classifier() -> WasteClassifier:
    """Return a singleton WasteClassifier instance (lazy-loaded)."""
    global _classifier
    if _classifier is None:
        _classifier = WasteClassifier()
    return _classifier
