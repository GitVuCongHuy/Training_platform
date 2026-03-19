# backend/api/gen_ai_api.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List
import json
from sqlalchemy.orm import Session
from ..database import crud
from ..database.database import get_db
from ..services.generation import gen_ai_service
from .. import task_manager

router = APIRouter()

class ClassPrompt(BaseModel):
    name: str = Field(..., example="fight")
    prompt: str = Field(..., example="A fight scene.")

class GenAiRequest(BaseModel):
    classes: List[ClassPrompt]
    output_path: str = Field(..., example="/path/to/output")
    num_images_per_class: int = Field(default=500, ge=1, le=10000, example=500)
    api_key: str = Field(default="", example="sk_xxxx")

@router.post("/start-generation")
async def start_generation(
    request: GenAiRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    if not request.classes or not request.output_path:
        raise HTTPException(status_code=400, detail="Missing classes or output_path.")

    task_id = task_manager.create_task("gen_ai")
    
    background_tasks.add_task(
        gen_ai_service.generate_images_for_classes,
        db,
        task_id,
        [c.dict() for c in request.classes],
        request.output_path,
        request.num_images_per_class,
        request.api_key
    )
    return {"message": "Generation task started.", "task_id": task_id}

@router.get("/history")
async def read_history(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    history_items = crud.get_history(db, skip=skip, limit=limit)
    for item in history_items:
        item.classes_data = json.loads(item.classes_data)
    return history_items

@router.delete("/history/{entry_id}")
async def delete_history(entry_id: int, db: Session = Depends(get_db)):
    success = crud.delete_history_entry(db, entry_id)
    if not success:
        raise HTTPException(status_code=404, detail="History item not found.")
    return {"message": "Deleted successfully."}