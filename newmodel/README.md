---
language: en
license: mit
tags:
- image-classification
- pytorch
- garbage-classification
- waste-management
- environmental
datasets:
- garbage-classification-dataset
metrics:
- accuracy
- cross-entropy-loss
library_name: pytorch
pipeline_tag: image-classification
---

# Garbage Classification Model (LargeNet)

## Model Description

This is a PyTorch-based convolutional neural network trained to classify images of garbage into 7 categories:
- **Battery**: Used batteries and battery waste
- **Biological**: Organic and biodegradable waste
- **Cardboard**: Cardboard boxes and packaging
- **Glass**: Glass bottles, jars, and containers
- **Metal**: Metal cans, foil, and containers
- **Paper**: Paper waste, documents, and newspaper
- **Plastic**: Plastic bottles, bags, and containers

The model uses a custom CNN architecture called "LargeNet" that processes 128x128 RGB images.

## Model Architecture

```
LargeNet(
  (conv1): Conv2d(3, 5, kernel_size=5)
  (pool): MaxPool2d(kernel_size=2, stride=2)
  (conv2): Conv2d(5, 10, kernel_size=5)
  (fc1): Linear(in_features=8410, out_features=32)
  (fc2): Linear(in_features=32, out_features=7)
)
```

**Architecture Details:**
- Input: 128x128 RGB images
- 2 Convolutional layers with ReLU activation
- MaxPooling after each convolution
- 2 Fully connected layers
- Output: 7 classes with softmax probabilities

## Training Details

**Training Hyperparameters:**
- Batch size: 64
- Learning rate: 0.01
- Optimizer: SGD
- Loss function: CrossEntropyLoss
- Best epoch: 61
- Training dataset: Garbage Classification Dataset (2100 images)

**Data Preprocessing:**
- Images resized to 128x128 pixels
- Normalized with mean=[0.5, 0.5, 0.5] and std=[0.5, 0.5, 0.5]
- Data split: 72% train, 18% validation, 10% test

## Usage

### Quick Start

```python
from inference import GarbageClassifier

# Initialize the classifier
classifier = GarbageClassifier(".")

# Classify an image
result = classifier.predict("path/to/garbage_image.jpg")

print(f"Predicted class: {result['class']}")
print(f"Confidence: {result['confidence']:.2%}")
print(f"All probabilities: {result['all_probabilities']}")
```

### Manual Usage

```python
import torch
from PIL import Image
from torchvision import transforms
from model import load_model

# Load model
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = load_model("pytorch_model.bin", device)

# Prepare image
transform = transforms.Compose([
    transforms.Resize((128, 128)),
    transforms.ToTensor(),
    transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
])

image = Image.open("image.jpg").convert('RGB')
image_tensor = transform(image).unsqueeze(0).to(device)

# Predict
with torch.no_grad():
    outputs = model(image_tensor)
    probabilities = torch.nn.functional.softmax(outputs, dim=1)
    _, predicted = torch.max(probabilities, 1)

class_names = ["battery", "biological", "cardboard", "glass", "metal", "paper", "plastic"]
print(f"Predicted class: {class_names[predicted.item()]}")
```

## Model Performance

The model achieved competitive performance on the garbage classification task. For detailed metrics and performance analysis, please refer to the training logs and evaluation results.

## Limitations and Bias

- The model is trained on a specific garbage dataset and may not generalize well to all types of waste
- Performance may vary with different lighting conditions, image quality, and garbage appearances
- The dataset may have regional or cultural biases in garbage representation
- Works best with clear, well-lit images of individual garbage items

## Intended Use

This model is intended for:
- Educational purposes in waste management and environmental studies
- Prototype development for waste sorting applications
- Research in automated recycling systems
- Environmental awareness applications

**Not recommended for:**
- Production waste sorting systems without additional validation
- Critical infrastructure without human oversight
- Scenarios requiring 100% accuracy

## Citation

If you use this model, please cite:
```
@misc{garbage-classifier-largenet,
  author = {Your Name},
  title = {Garbage Classification Model},
  year = {2026},
  publisher = {HuggingFace},
  url = {https://huggingface.co/your-username/garbage-classifier-largenet}
}
```

## License

MIT License

## Contact

For questions or feedback, please open an issue on the model repository.
