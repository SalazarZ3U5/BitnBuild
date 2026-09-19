"""
Fill-level prediction API.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Bin
from app.ml.fill_predictor import predict_overflow

router = APIRouter(tags=["predict"])


@router.get("/predict/{bin_id}")
def predict_bin_overflow(bin_id: int, db: Session = Depends(get_db)):
    """Predict when a bin will overflow based on its fill reading history."""
    bin_obj = db.query(Bin).filter(Bin.id == bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")

    result = predict_overflow(db, bin_obj)
    return result
