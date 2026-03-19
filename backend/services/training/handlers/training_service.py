# backend/services/training/handlers/training_service.py
"""
Training Service - xử lý logic cho training sessions
"""
import threading
from sqlalchemy.orm import Session

from ....database import models
from .runner import run_training_job
from .job_manager import job_manager


def create_training_session(db: Session, cfg: dict) -> models.TrainingSession:
    """
    Tạo training session mới trong database.
    
    Args:
        db: Database session
        cfg: Configuration dict từ API request
        
    Returns:
        TrainingSession model instance
    """
    task_suffix = "cls" if cfg["task_type"] == "classification" else "det"
    model_arch = f"{cfg['model_family']}_{cfg['model_version']}_{cfg['model_size']}_{task_suffix}"
    
    session_name = cfg.get("session_name")
    if not session_name or not session_name.strip():
        session_name = None
        
    ts = models.TrainingSession(
        session_name=session_name,
        dataset_path=cfg["dataset_path"],
        final_dataset_path=None,
        task_type=cfg["task_type"],
        model_family=cfg["model_family"],
        model_version=cfg["model_version"],
        model_size=cfg["model_size"],
        model_arch=model_arch,
        aug_preset=cfg["aug_preset"],
        epochs=cfg["epochs"],
        lr=cfg["lr"],
        batch_size=cfg["batch_size"],
        img_width=cfg["img_width"],
        img_height=cfg["img_height"],
        split_train_ratio=cfg["split_train_ratio"],
        split_val_ratio=cfg["split_val_ratio"],
        split_test_ratio=cfg["split_test_ratio"],
        status="pending",
        total_epochs=cfg["epochs"],
    )
    db.add(ts)
    db.commit()
    db.refresh(ts)
    return ts


def start_training_job(training_id: int):
    """
    Bắt đầu training job trong background thread.
    
    Args:
        training_id: ID của TrainingSession
    """
    t = threading.Thread(target=run_training_job, args=(training_id,), daemon=True)
    t.start()
    job_manager.register_thread(training_id, t)


def request_stop(training_id: int):
    """
    Yêu cầu dừng training job.
    
    Args:
        training_id: ID của TrainingSession
    """
    job_manager.request_stop(training_id)


def get_training_status(db: Session, training_id: int) -> dict:
    """
    Lấy trạng thái training hiện tại.
    Kết hợp dữ liệu từ DB và in-memory progress.
    
    Args:
        db: Database session
        training_id: ID của TrainingSession
        
    Returns:
        Dict chứa training status và metrics
    """
    ts = db.query(models.TrainingSession).filter(
        models.TrainingSession.id == training_id
    ).first()
    
    if ts is None:
        return {"error": "not_found"}
    
    # Check in-memory progress first
    prog = job_manager.get_progress(training_id)
    if prog:
        return {
            "id": ts.id, 
            "session_name": ts.session_name,
            "status": prog.get("status", "running"),
            "current_epoch": prog.get("current_epoch"),
            "total_epochs": prog.get("total_epochs"),
            "percent": prog.get("percent"), 
            "train_loss": prog.get("train_loss"),
            "val_loss": prog.get("val_loss"), 
            "val_acc": prog.get("val_acc"),
            "best_map50": prog.get("best_map50"),
            "error_message": prog.get("error_message"),
            "dataset_path": ts.final_dataset_path or ts.dataset_path,
            "final_dataset_path": ts.final_dataset_path, 
            "task_type": ts.task_type,
            "model_arch": ts.model_arch, 
            "checkpoint_path": ts.checkpoint_path,
            "best_metric_note": ts.best_metric_note,
            "confusion_matrix_json": ts.confusion_matrix_json,
            "class_names_json": ts.class_names_json,
            "train_loss_history": ts.train_loss_history,
            "val_loss_history": ts.val_loss_history,
            "val_acc_history": ts.val_acc_history
        }
    
    # Fallback to DB data nếu không có in-memory progress
    return {
        "id": ts.id, 
        "session_name": ts.session_name, 
        "status": ts.status,
        "current_epoch": ts.current_epoch, 
        "total_epochs": ts.total_epochs,
        "percent": 100.0 if ts.status == "finished" else 0.0,
        "train_loss": ts.train_loss, 
        "val_loss": ts.val_loss, 
        "val_acc": ts.val_acc,
        "best_map50": ts.best_map50,
        "error_message": None,
        "dataset_path": ts.final_dataset_path or ts.dataset_path,
        "final_dataset_path": ts.final_dataset_path, 
        "task_type": ts.task_type,
        "model_arch": ts.model_arch, 
        "checkpoint_path": ts.checkpoint_path,
        "best_metric_note": ts.best_metric_note,
        "confusion_matrix_json": ts.confusion_matrix_json,
        "class_names_json": ts.class_names_json,
        "train_loss_history": ts.train_loss_history,
        "val_loss_history": ts.val_loss_history,
        "val_acc_history": ts.val_acc_history,
        "detection_metrics_history_json": ts.detection_metrics_history_json,
    }
