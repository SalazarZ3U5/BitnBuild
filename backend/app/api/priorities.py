"""
Collection prioritization API.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.ml.prioritizer import compute_priorities

router = APIRouter(tags=["priorities"])


@router.get("/priorities")
def get_priorities(db: Session = Depends(get_db)):
    """Return all bins ranked by collection priority score."""
    return compute_priorities(db)
