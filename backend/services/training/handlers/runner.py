# backend/services/training/handlers/runner.py
"""
Training job runner - thực thi training jobs với factory pattern
"""
from sqlalchemy.orm import Session
from typing import Optional
import gc
import torch

from ....database.database import SessionLocal
from ....database import models
from .job_manager import job_manager
from ..trainers.base import BaseTrainer
from ..trainers.classifier import YoloClassifierTrainer
from ..trainers.detector import YoloDetectorTrainer


def _cleanup_gpu_memory():
    """Giải phóng VRAM sau khi training kết thúc hoặc bị cancel."""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
    print("[Cleanup] GPU memory released")


def create_trainer_factory(db: Session, ts: models.TrainingSession) -> Optional[BaseTrainer]:
    """
    Factory pattern để tạo trainer phù hợp với task type.
    
    Args:
        db: Database session
        ts: TrainingSession model instance
        
    Returns:
        Trainer instance hoặc None nếu task type không hỗ trợ
    """
    if ts.task_type == "classification":
        return YoloClassifierTrainer(db, ts)
    
    elif ts.task_type == "detection":
        return YoloDetectorTrainer(db, ts)
        
    else:
        ts.status = "failed"
        ts.best_metric_note = f"Task type '{ts.task_type}' không được hỗ trợ."
        db.commit()
        return None


def run_training_job(job_id: int):
    """
    Main entry point để chạy training job.
    Được gọi trong background thread.
    
    Args:
        job_id: ID của TrainingSession trong database
    """
    db: Session = SessionLocal()
    ts = None
    trainer = None
    
    try:
        ts = db.query(models.TrainingSession).filter(
            models.TrainingSession.id == job_id
        ).first()
        
        if ts is None:
            return

        # 1. Dùng Factory để tạo trainer
        trainer = create_trainer_factory(db, ts)
        
        if trainer is None:
            # Factory đã xử lý lỗi và cập nhật DB
            return

        # 2. Đăng ký trainer với JobManager
        job_manager.register_job(job_id, trainer)

        # 3. Chạy job (đây là hàm blocking)
        trainer.run()

    except KeyboardInterrupt:
        print(f"[Training Job {job_id}] Received KeyboardInterrupt - YOLO gracefully exiting and saving model")
        if trainer:
            trainer.set_progress(
                status="cancelled", 
                message="Training đã bị dừng. Model đã được lưu tại last.pt"
            )
        if ts:
            ts.status = "cancelled"
            ts.best_metric_note = "Training stopped by user"
            db.commit()
            
    except Exception as e:
        print(f"!!! FATAL JOB ERROR (job_id: {job_id}): {e} !!!")
        if ts and trainer:
            trainer._handle_error(f"Fatal Error: {e}", f"Fatal Error: {e}")
        elif ts:
            ts.status = "failed"
            ts.best_metric_note = f"Fatal Error (pre-init): {e}"
            db.commit()
            
    finally:
        # Always cleanup GPU memory
        _cleanup_gpu_memory()
        db.close()
        job_manager.clear_job_if_done(job_id)
