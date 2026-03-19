# backend/database/crud.py
from sqlalchemy.orm import Session
from . import models

def get_history(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.PromptHistory).order_by(models.PromptHistory.created_at.desc()).offset(skip).limit(limit).all()

def create_history_entry(db: Session, classes_data: str, output_path: str):
    db_item = models.PromptHistory(classes_data=classes_data, output_path=output_path)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def delete_history_entry(db: Session, entry_id: int):
    db_item = db.query(models.PromptHistory).filter(models.PromptHistory.id == entry_id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
        return True
    return False