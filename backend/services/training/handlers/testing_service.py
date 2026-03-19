# backend/services/training/handlers/testing_service.py
"""
Testing Service - xử lý logic cho testing/validation sessions
"""
import threading
import json
from sqlalchemy.orm import Session
from ultralytics import YOLO
import numpy as np

from ....database import models
from ....database.database import get_db
from .job_manager import job_manager
from ..utils.dataset import prepare_test_data, TEST_OUTPUT_ROOT


def _calculate_classification_metrics(cm_matrix) -> dict:
    """
    Tính toán metrics chi tiết từ confusion matrix cho classification.
    
    Args:
        cm_matrix: Confusion matrix dạng 2D array
        
    Returns:
        Dict chứa precision, recall, f1 (macro và weighted)
    """
    try:
        cm = np.array(cm_matrix)
        n_classes = cm.shape[0]
        if n_classes == 0:
            return {}
            
        epsilon = 1e-9
        tp = np.diag(cm)
        fp = cm.sum(axis=0) - tp
        fn = cm.sum(axis=1) - tp
        
        precision_per_class = (tp + epsilon) / (tp + fp + epsilon)
        recall_per_class = (tp + epsilon) / (tp + fn + epsilon)
        f1_per_class = 2 * (precision_per_class * recall_per_class) / (precision_per_class + recall_per_class + epsilon)
        
        # Macro averages
        macro_precision = np.mean(precision_per_class)
        macro_recall = np.mean(recall_per_class)
        macro_f1 = np.mean(f1_per_class)
        
        # Weighted averages
        total_samples_per_class = cm.sum(axis=1)
        total_samples = np.sum(total_samples_per_class)
        weighted_precision = np.sum(precision_per_class * total_samples_per_class) / total_samples
        weighted_recall = np.sum(recall_per_class * total_samples_per_class) / total_samples
        weighted_f1 = np.sum(f1_per_class * total_samples_per_class) / total_samples
        
        return {
            "precision_macro": macro_precision,
            "recall_macro": macro_recall,
            "f1_macro": macro_f1,
            "precision_weighted": weighted_precision,
            "recall_weighted": weighted_recall,
            "f1_weighted": weighted_f1,
            "precision_per_class": precision_per_class.tolist(),
            "recall_per_class": recall_per_class.tolist(),
            "f1_per_class": f1_per_class.tolist()
        }
    except Exception as e:
        print(f"Error calculating metrics: {e}")
        return {}


class TestingJob:
    """
    Testing job runner - chạy validation/testing trên model đã train
    """
    
    def __init__(self, test_id: int):
        self.test_id = test_id
        self.state = {
            "status": "pending",
            "message": "Job created",
            "percent": 0.0,
            "metrics": None,
        }

    def _set_progress(self, status: str, message: str = None, percent: float = 0.0, metrics: dict = None):
        """Cập nhật progress state"""
        self.state["status"] = status
        self.state["message"] = message
        self.state["percent"] = percent
        if metrics is not None:
            self.state["metrics"] = metrics

    def get_progress(self) -> dict:
        """Lấy progress hiện tại"""
        return self.state

    def run(self):
        """
        Main testing logic - chạy validation trên test dataset
        """
        prog_callback = self._set_progress
        db: Session = next(get_db())
        ts: models.TestingSession = None
        
        try:
            ts = db.query(models.TestingSession).filter(
                models.TestingSession.id == self.test_id
            ).first()
            
            if not ts:
                prog_callback("failed", f"Test session {self.test_id} not found.", 0)
                return

            ts.status = "running"
            db.commit()
            prog_callback("running", "Starting test...", 10)

            prog_callback("running", "Preparing & analyzing test dataset...", 20)
            final_data_path, detected_task, class_names_from_data = prepare_test_data(ts, TEST_OUTPUT_ROOT)
            
            ts.task_type = detected_task
            db.commit()
            
            prog_callback("running", f"Task detected: {detected_task}. Loading model...", 40)
            
            # Load model
            model = YOLO(ts.model_path)
            
            # --- Check Mismatch ---
            model_task = model.task
            if detected_task == "classification" and model_task != "classify":
                 raise ValueError(f"Lỗi: Model là '{model_task}' nhưng dữ liệu là Classification.")
            
            if detected_task == "detection" and model_task not in ["detect", "segment"]:
                 raise ValueError(f"Lỗi: Model là '{model_task}' nhưng dữ liệu là Detection.")
            # ----------------------
            
            prog_callback("running", "Running model validation...", 60)
            
            metrics = model.val(
                data=final_data_path, 
                split='test', 
                plots=True,
                project=str(TEST_OUTPUT_ROOT / f"session_{self.test_id}"),
                name="val"
            )
            
            prog_callback("running", "Validation complete. Saving results...", 90)

            # Extract class names
            class_names_list = []
            names_dict = None
            
            if hasattr(model, 'names') and isinstance(model.names, dict):
                names_dict = model.names
            elif class_names_from_data:
                names_dict = {i: name for i, name in enumerate(class_names_from_data)}
            elif hasattr(metrics, 'names') and isinstance(metrics.names, dict):
                names_dict = metrics.names

            if names_dict:
                try:
                    sorted_keys = sorted(names_dict.keys())
                    class_names_list = [names_dict[k] for k in sorted_keys]
                except Exception as e:
                    print(f"Error processing names_dict: {e}")
            
            metrics_dict = {}
            cm_matrix = None

            # Process metrics based on task type
            if detected_task == "classification":
                metrics_dict = {
                    "accuracy_top1": float(metrics.top1),
                    "accuracy_top5": float(metrics.top5),
                    "class_names": class_names_list
                }

                if hasattr(metrics, 'confusion_matrix') and metrics.confusion_matrix is not None:
                    cm_matrix = metrics.confusion_matrix.matrix.tolist()
                    adv_metrics = _calculate_classification_metrics(cm_matrix)
                    metrics_dict.update(adv_metrics)

            elif detected_task == "detection":
                eps = 1e-9

                # Calculate mean precision/recall
                if hasattr(metrics.box, "mp") and metrics.box.mp is not None:
                    precision_mean = float(metrics.box.mp)
                else:
                    p_arr = metrics.box.p if hasattr(metrics.box, "p") else None
                    precision_mean = float(np.mean(p_arr)) if p_arr is not None and p_arr.size > 0 else 0.0

                if hasattr(metrics.box, "mr") and metrics.box.mr is not None:
                    recall_mean = float(metrics.box.mr)
                else:
                    r_arr = metrics.box.r if hasattr(metrics.box, "r") else None
                    recall_mean = float(np.mean(r_arr)) if r_arr is not None and r_arr.size > 0 else 0.0

                f1_score = (2 * precision_mean * recall_mean) / (precision_mean + recall_mean + eps)

                metrics_dict = {
                    "map50": float(metrics.box.map50) if hasattr(metrics.box, "map50") else None,
                    "map": float(metrics.box.map) if hasattr(metrics.box, "map") else None,
                    "precision": precision_mean,
                    "recall": recall_mean,
                    "f1_score": f1_score,
                    "class_names": class_names_list
                }

                # Per-class metrics if available
                try:
                    if hasattr(metrics.box, "p") and metrics.box.p is not None:
                        metrics_dict["precision_per_class"] = metrics.box.p.tolist()
                    if hasattr(metrics.box, "r") and metrics.box.r is not None:
                        metrics_dict["recall_per_class"] = metrics.box.r.tolist()

                    if "precision_per_class" in metrics_dict and "recall_per_class" in metrics_dict:
                        p_pc = np.array(metrics_dict["precision_per_class"])
                        r_pc = np.array(metrics_dict["recall_per_class"])
                        f1_pc = (2 * p_pc * r_pc) / (p_pc + r_pc + eps)
                        metrics_dict["f1_per_class"] = f1_pc.tolist()
                except Exception as e:
                    print(f"Cannot build per-class metrics: {e}")

                if hasattr(metrics, 'confusion_matrix') and metrics.confusion_matrix is not None:
                    cm_matrix = metrics.confusion_matrix.matrix.tolist()

            # Save results to DB
            ts.status = "finished"
            ts.metrics_json = json.dumps(metrics_dict)
            if cm_matrix:
                ts.confusion_matrix_json = json.dumps(cm_matrix)
            
            db.commit()
            prog_callback("finished", "Test complete.", 100, metrics=metrics_dict)

        except Exception as e:
            print(f"Testing job failed: {e}")
            import traceback
            traceback.print_exc()
            error_msg = str(e)
            if ts:
                ts.status = "failed"
                ts.error_message = error_msg
                db.commit()
            prog_callback("failed", error_msg, 0)
            
        finally:
            db.close()
            job_manager.clear_job_if_done(self.test_id)


def create_testing_session(db: Session, cfg: dict) -> models.TestingSession:
    """
    Tạo testing session mới trong database.
    
    Args:
        db: Database session
        cfg: Configuration dict từ API request
        
    Returns:
        TestingSession model instance
    """
    ts = models.TestingSession(
        model_path=cfg["model_path"],
        dataset_path=cfg["dataset_path"],
        session_name=cfg.get("session_name"),
        training_id=cfg.get("training_id"),
        status="pending"
    )
    db.add(ts)
    db.commit()
    db.refresh(ts)
    return ts


def start_testing_job(test_id: int):
    """
    Bắt đầu testing job trong background thread.
    
    Args:
        test_id: ID của TestingSession
    """
    test_job = TestingJob(test_id)
    job_manager.register_job(test_id, test_job)
    t = threading.Thread(target=test_job.run, args=(), daemon=True)
    t.start()


def get_testing_status(db: Session, test_id: int) -> dict:
    """
    Lấy trạng thái testing hiện tại.
    
    Args:
        db: Database session
        test_id: ID của TestingSession
        
    Returns:
        Dict chứa testing status và metrics
    """
    ts = db.query(models.TestingSession).filter(
        models.TestingSession.id == test_id
    ).first()
    
    if ts is None:
        return {"error": "not_found"}
    
    # Check in-memory progress
    prog = job_manager.get_progress(test_id)
    if prog:
        return {
            "id": ts.id,
            "status": prog.get("status"),
            "message": prog.get("message"),
            "percent": prog.get("percent"),
            "metrics": prog.get("metrics"),
            "model_path": ts.model_path,
            "dataset_path": ts.dataset_path,
            "task_type": ts.task_type
        }
    
    # Fallback to DB data
    metrics = None
    if ts.metrics_json:
        try:
            metrics = json.loads(ts.metrics_json)
        except:
            pass
        
    confusion_matrix = None
    if ts.confusion_matrix_json:
        try:
            confusion_matrix = json.loads(ts.confusion_matrix_json)
        except:
            pass
            
    return {
        "id": ts.id,
        "status": ts.status,
        "message": ts.error_message or "Test finished",
        "percent": 100.0 if ts.status == "finished" else 0.0,
        "metrics": metrics,
        "model_path": ts.model_path,
        "confusion_matrix": confusion_matrix,
        "dataset_path": ts.dataset_path,
        "task_type": ts.task_type
    }
