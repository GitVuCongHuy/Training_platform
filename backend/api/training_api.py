# D:\New folder\backend\api\training_api.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from pathlib import Path
from ..database.database import get_db
from ..database import models
from ..database.utils import safe_json_load
from ..config import settings
from ..services.training.handlers import training_service
from ..services.training.handlers import testing_service
import json

router = APIRouter()

class TrainRequest(BaseModel):
    session_name: str | None = None
    dataset_path: str
    task_type: str = Field(..., pattern="^(classification|detection)$")
    model_family: str = Field(..., pattern="^(yolo)$")
    model_version: str = Field(..., pattern="^(v8|v10|v11)$")
    model_size: str = Field(..., pattern="^(n|s|m|l|x)$")
    aug_preset: str
    epochs: int
    lr: float
    batch_size: int
    img_width: int
    img_height: int
    split_train_ratio: float = 0.7
    split_val_ratio: float = 0.2
    split_test_ratio: float = 0.1

@router.post("/start")
def start_training(req: TrainRequest, db: Session = Depends(get_db)):
    ts = training_service.create_training_session(db, req.model_dump())
    training_service.start_training_job(ts.id)
    return {
        "training_id": ts.id,
        "status": "started",
        "message": f"Training session {ts.session_name} created."
    }

@router.post("/stop/{training_id}")
def stop_training(training_id: int, db: Session = Depends(get_db)):
    training_service.request_stop(training_id)
    return {"message": "stop requested"}

@router.get("/status/{training_id}")
def get_status(training_id: int, db: Session = Depends(get_db)):
    return training_service.get_training_status(db, training_id)


@router.get("/history")
def get_training_history(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    sessions = db.query(models.TrainingSession)\
        .order_by(models.TrainingSession.created_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()

    result = []
    for s in sessions:
        result.append({
            "id": s.id,
            "session_name": s.session_name,
            "task_type": s.task_type,
            "model_arch": s.model_arch,
            "status": s.status,
            "checkpoint_path": s.checkpoint_path,

            # ===== NEW FIELDS =====
            "epochs": s.epochs,
            "gpu_mem_max": s.gpu_mem_max,
            "num_classes": s.num_classes,
            "dataset_stats_json": s.dataset_stats_json,

            # ===== old fields =====
            "val_acc": s.val_acc,
            "best_map50": s.best_map50,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    return {"sessions": result, "total": len(result)}


@router.get("/metrics/{training_id}")
def get_training_metrics(training_id: int, db: Session = Depends(get_db)):
    ts = db.query(models.TrainingSession)\
        .filter(models.TrainingSession.id == training_id)\
        .first()
    
    if ts is None:
        return {"error": "not_found"}
    
    confusion_matrix = safe_json_load(ts.confusion_matrix_json)
    class_names = safe_json_load(ts.class_names_json)
    train_loss_history = safe_json_load(ts.train_loss_history)
    val_loss_history = safe_json_load(ts.val_loss_history)
    val_acc_history = safe_json_load(ts.val_acc_history)
    
    detection_metrics_history_json = safe_json_load(ts.detection_metrics_history_json)
    
    dataset_stats = safe_json_load(ts.dataset_stats_json, default_val=None)

    return {
        "id": ts.id,
        "session_name": ts.session_name,
        "status": ts.status,
        "task_type": ts.task_type,
        "model_arch": ts.model_arch,
        "epochs": ts.epochs,
        "lr": ts.lr,
        "batch_size": ts.batch_size,
        "img_width": ts.img_width,
        "img_height": ts.img_height,

        "train_loss": ts.train_loss,
        "val_loss": ts.val_loss,
        "val_acc": ts.val_acc,
        "best_map50": ts.best_map50,
        "confusion_matrix": confusion_matrix,
        "class_names": class_names,
        "train_loss_history": train_loss_history,
        "val_loss_history": val_loss_history,
        "val_acc_history": val_acc_history,
        "detection_metrics_history_json": detection_metrics_history_json,
        "checkpoint_path": ts.checkpoint_path,
        "dataset_path": ts.final_dataset_path or ts.dataset_path,

        "gpu_mem_max": ts.gpu_mem_max,
        "num_classes": ts.num_classes,
        "dataset_stats_json": dataset_stats,

        "created_at": ts.created_at.isoformat() if ts.created_at else None,
        "best_metric_note": ts.best_metric_note,
    }

@router.delete("/history/{training_id}")
def delete_training_session(training_id: int, db: Session = Depends(get_db)):
    ts = db.query(models.TrainingSession)\
        .filter(models.TrainingSession.id == training_id)\
        .first()
    
    if ts is None:
        return {"error": "not_found"}
    
    db.delete(ts)
    db.commit()
    
    return {"message": f"Deleted session {training_id}"}


class TestRequest(BaseModel):
    model_path: str
    dataset_path: str
    session_name: str | None = None   
    training_id: int | None = None 

@router.post("/test/start")
def start_testing(req: TestRequest, db: Session = Depends(get_db)):
    ts = testing_service.create_testing_session(db, req.model_dump())
    testing_service.start_testing_job(ts.id)
    return {
        "test_id": ts.id,
        "status": "started",
        "message": "Testing session created."
    }

@router.get("/test/status/{test_id}")
def get_test_status(test_id: int, db: Session = Depends(get_db)):
    return testing_service.get_testing_status(db, test_id)

@router.get("/test/history")
def get_testing_history(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    sessions = db.query(models.TestingSession)\
        .order_by(models.TestingSession.created_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    result = []
    for s in sessions:
        metrics = None
        if s.metrics_json:
            try: metrics = json.loads(s.metrics_json)
            except: pass
        
        result.append({
            "id": s.id,
            "session_name": s.session_name,            
            "training_id": s.training_id,  
            "model_path": s.model_path,
            "dataset_path": s.dataset_path,
            "task_type": s.task_type,
            "status": s.status,
            "metrics": metrics, 
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })
    
    return {"sessions": result, "total": len(result)}

@router.get("/test/metrics/{test_id}")
def get_testing_metrics(test_id: int, db: Session = Depends(get_db)):
    ts = db.query(models.TestingSession)\
        .filter(models.TestingSession.id == test_id)\
        .first()
    
    if ts is None:
        return {"error": "not_found"}
    
    metrics = None
    if ts.metrics_json:
        try: metrics = json.loads(ts.metrics_json)
        except: pass
    
    confusion_matrix = None
    if ts.confusion_matrix_json:
        try: confusion_matrix = json.loads(ts.confusion_matrix_json)
        except: pass
    
    return {
        "id": ts.id,
        "status": ts.status,
        "session_name": ts.session_name,
        "training_id": ts.training_id,
        "model_path": ts.model_path,
        "dataset_path": ts.dataset_path,
        "task_type": ts.task_type,
        "metrics": metrics,
        "confusion_matrix": confusion_matrix,
        "error_message": ts.error_message,
        "created_at": ts.created_at.isoformat() if ts.created_at else None,
    }

@router.delete("/test/history/{test_id}")
def delete_testing_session(test_id: int, db: Session = Depends(get_db)):
    ts = db.query(models.TestingSession)\
        .filter(models.TestingSession.id == test_id)\
        .first()
    
    if ts is None:
        return {"error": "not_found"}
    
    db.delete(ts)
    db.commit()
    
    return {"message": f"Deleted test session {test_id}"}


# ========== MODEL DOWNLOAD ==========
STORAGE_ROOT = Path(settings.BASE_DIR) / "storage"

@router.get("/download-model")
def download_model(path: str):
    """Download a trained model file (.pt) by its absolute path."""
    p = Path(path).resolve()
    if not p.is_file():
        raise HTTPException(status_code=404, detail="Model file not found")
    
    # Security: only allow files inside the storage directory
    storage_root = STORAGE_ROOT.resolve()
    try:
        p.relative_to(storage_root)
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied: file is outside storage directory")
    
    return FileResponse(str(p), filename=p.name, media_type="application/octet-stream")

@router.get("/validate-path")
def validate_path(path: str):
    """Check if a given directory path exists."""
    p = Path(path).resolve()
    return {"exists": p.is_dir()}