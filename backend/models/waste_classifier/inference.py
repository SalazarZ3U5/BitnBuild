import torch
from PIL import Image
from torchvision import transforms
from model import load_model
import json
import os

class GarbageClassifier:
    def __init__(self, model_dir="."):
        """Initialize the garbage classifier"""
        # Load config
        with open(os.path.join(model_dir, "config.json"), "r") as f:
            self.config = json.load(f)

        # Setup device
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Load model
        model_path = os.path.join(model_dir, "pytorch_model.bin")
        self.model = load_model(model_path, self.device)

        # Setup transforms
        mean = self.config["normalization"]["mean"]
        std = self.config["normalization"]["std"]
        size = tuple(self.config["input_size"])

        self.transform = transforms.Compose([
            transforms.Resize(size),
            transforms.ToTensor(),
            transforms.Normalize(mean, std)
        ])

        self.class_names = self.config["class_names"]

    def predict(self, image_path):
        """
        Predict the class of a garbage image

        Args:
            image_path: Path to the image file

        Returns:
            dict: Contains 'class', 'confidence', and 'all_probabilities'
        """
        # Load and preprocess image
        image = Image.open(image_path).convert('RGB')
        image_tensor = self.transform(image).unsqueeze(0).to(self.device)

        # Make prediction
        with torch.no_grad():
            outputs = self.model(image_tensor)
            probabilities = torch.nn.functional.softmax(outputs, dim=1)
            confidence, predicted = torch.max(probabilities, 1)

        # Format results
        predicted_class = self.class_names[predicted.item()]
        confidence_score = confidence.item()
        all_probs = {
            self.class_names[i]: probabilities[0][i].item() 
            for i in range(len(self.class_names))
        }

        return {
            "class": predicted_class,
            "confidence": confidence_score,
            "all_probabilities": all_probs
        }

# Example usage:
if __name__ == "__main__":
    classifier = GarbageClassifier(".")
    result = classifier.predict("path/to/image.jpg")
    print(f"Predicted class: {result['class']}")
    print(f"Confidence: {result['confidence']:.2%}")
