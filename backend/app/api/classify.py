"""
Waste image classification API.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.ml.waste_classifier import get_classifier

router = APIRouter(tags=["classify"])


@router.post("/classify")
async def classify_waste_image(file: UploadFile = File(...)):
    """Accept an uploaded image and return the predicted waste category and confidence."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await file.read()
    classifier = get_classifier()
    result = classifier.classify(image_bytes)
    return result
