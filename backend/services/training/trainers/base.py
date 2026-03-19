# backend/services/training/trainers/base.py
import json
from abc import ABC, abstractmethod
import os
from pathlib import Path
from sqlalchemy.orm import Session
from datetime import datetime
import numpy as np 
from ultralytics import YOLO 
import time 
import gc 
import torch 

from ....config import settings
from ....database import models
from ..utils.dataset import prepare_dataset

ARTIFACT_ROOT = Path(settings.BASE_DIR) / "storage"

TRAIN_OUTPUT_ROOT = ARTIFACT_ROOT / "training_sessions"
TRAIN_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

def _count_imgs_in_dir(p: Path) -> int:
    if not p.exists():
        return 0
    n = 0
    for ext in IMG_EXTS:
        n += len(list(p.rglob(f"*{ext}")))
    return n

def _build_classification_stats(root: Path):
    """
    Classification dataset dạng:
      root/
        train/classA/*.jpg
        val/classA/*.jpg
        test/classA/*.jpg
    """
    splits = {}
    all_classes = set()

    for split in ["train", "val", "test"]:
        sp = root / split
        if not sp.exists():
            continue
        per_class = {}
        for cls_dir in sp.iterdir():
            if cls_dir.is_dir():
                cnt = _count_imgs_in_dir(cls_dir)
                per_class[cls_dir.name] = cnt
                all_classes.add(cls_dir.name)
        splits[split] = {
            "total": sum(per_class.values()),
            "per_class": per_class
        }

    if not splits:
        return None

    return {
        "num_classes": len(all_classes),
        "splits": splits
    }

def _try_build_detection_stats(data_path: Path):
    """
    Detection dataset dạng YOLO data.yaml hoặc folder.
    Ta cố gắng đọc data.yaml nếu có để biết class names.
    """
    yaml_path = None
    if data_path.is_file() and data_path.suffix in [".yaml", ".yml"]:
        yaml_path = data_path
        root = yaml_path.parent
    else:
        # thử tìm data.yaml trong folder
        for name in ["data.yaml", "dataset.yaml"]:
            p = data_path / name
            if p.exists():
                yaml_path = p
                root = data_path
                break

    if yaml_path is None:
        return None

    try:
        import yaml
        cfg = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    except Exception:
        return None

    names = cfg.get("names") or []
    if isinstance(names, dict):
        names = [names[k] for k in sorted(names.keys())]
    if not isinstance(names, list):
        names = []

    def resolve_split_dir(k):
        v = cfg.get(k)
        if not v:
            return None
        p = Path(v)
        if not p.is_absolute():
            p = (root / p).resolve()
        return p

    splits = {}
    for split in ["train", "val", "test"]:
        imgs_dir = resolve_split_dir(split)
        if not imgs_dir or not imgs_dir.exists():
            continue
        total = _count_imgs_in_dir(imgs_dir)
        # detection không dễ đếm per-class nếu không đọc labels -> tạm để rỗng
        splits[split] = {"total": total, "per_class": {}}

    if not splits:
        return None

    return {
        "num_classes": len(names) if names else None,
        "class_names": names,
        "splits": splits
    }

def build_dataset_stats(final_data_path: str, task_type: str):
    p = Path(final_data_path)
    if task_type == "classification":
        # final_data_path thường là folder dataset
        stats = _build_classification_stats(p if p.is_dir() else p.parent)
        return stats

    if task_type == "detection":
        stats = _try_build_detection_stats(p)
        return stats

    return None

def extract_max_gpu_mem(save_dir: Path):
    """
    đọc runs/results.csv của Ultralytics để lấy max GPU_mem (GB)
    """
    csv_path = save_dir / "results.csv"
    if not csv_path.exists():
        return None
    try:
        import pandas as pd
        df = pd.read_csv(csv_path)
        if "GPU_mem" not in df.columns:
            return None
        vals = []
        for x in df["GPU_mem"].dropna().tolist():
            try:
                if isinstance(x, str) and x.lower().endswith("g"):
                    vals.append(float(x[:-1]))
                else:
                    vals.append(float(x))
            except:
                pass
        return max(vals) if vals else None
    except Exception:
        return None

def extract_confusion_matrix_from_results(results_obj):
    try:
        if hasattr(results_obj, 'confusion_matrix'):
            cm = results_obj.confusion_matrix
            if hasattr(cm, 'matrix'):
                return cm.matrix.tolist()

        if hasattr(results_obj, 'metrics'):
            metrics = results_obj.metrics
            if hasattr(metrics, 'confusion_matrix'):
                return metrics.confusion_matrix.tolist()
    except Exception as e:
        print(f"Could not extract confusion matrix: {e}")

    return None

class BaseTrainer(ABC):

    def __init__(self, db: Session, ts: models.TrainingSession):
        self.db = db
        self.ts = ts
        self.job_id = ts.id

        if ts.task_type == "classification":
            self.session_root = Path(settings.TRAINING_OUTPUT_DIR_CLS)
        elif ts.task_type == "detection":
            self.session_root = Path(settings.TRAINING_OUTPUT_DIR_DET)
        else:
            self.session_root = TRAIN_OUTPUT_ROOT

        self.session_root.mkdir(parents=True, exist_ok=True)

        self.session_dir = self.session_root / f"session_{self.job_id}"
        self.session_dir.mkdir(parents=True, exist_ok=True)
        
        self._stop_requested = False
        
        self.state = {
            "status": "preparing",
            "current_epoch": 0,
            "gpu_mem_max": 0.0,   
            "total_epochs": ts.epochs,
            "train_loss": None,
            "val_loss": None,
            "val_acc": None,       
            "best_map50": None,  
            "percent": 0.0,
            "error_message": None,
            "message": None,
        }
        self.metrics_history = {
            "train_loss": [],
            "val_loss": [],
        }

    def get_progress(self) -> dict:
        return self.state

    def stop(self):
        self._stop_requested = True
        self.set_progress(
            status="cancelled",
            message="Đang dừng training... YOLO sẽ lưu model tại last.pt"
        )

    def set_progress(self, **kwargs):
        for k, v in kwargs.items():
            self.state[k] = v

    def _precheck_resources(self) -> tuple[bool, str]:
        if self.ts.batch_size and self.ts.batch_size > 64:
            return (False, "batch_size quá lớn (>64). vui lòng giảm xuống")
        pixels = (self.ts.img_width or 0) * (self.ts.img_height or 0)
        if pixels > 1_000_000:
            return (False, "Ảnh quá to (>1MP). Giảm img_width/img_height.")
        return (True, "")

    def _prepare_data(self) -> bool:
        try:
            self.set_progress(status="preparing", message="Analyzing dataset...")

            final_data_path, detected_task, class_names = prepare_dataset(
                self.ts,
                self.session_root,       
            )
            
            self.ts.final_dataset_path = final_data_path
            self.ts.task_type = detected_task      
            self.ts.class_names_json = class_names 
            stats = build_dataset_stats(final_data_path, detected_task)
            if stats:
                self.ts.dataset_stats_json = stats
                self.ts.num_classes = stats.get("num_classes")
            self.db.commit()
            return True
            
        except (ValueError, FileNotFoundError) as e:
            print(f"Data preparation failed: {e}")
            return self._handle_error(f"data_error: {e}", str(e))
        except Exception as e:
            print(f"Unexpected data preparation error: {e}")
            return self._handle_error(f"data_error: {e}", str(e))
    def _make_yolo_callbacks(self) -> dict:

        def on_fit_start(trainer):
            total_epochs = getattr(trainer, "epochs", None)
            self.set_progress(status="running", total_epochs=int(total_epochs or 0))

            try:
                if torch.cuda.is_available():
                    torch.cuda.reset_peak_memory_stats()
                    self.state["gpu_mem_max"] = 0.0
            except Exception as e:
                print("DEBUG reset gpu peak failed:", e)


        def on_fit_epoch_start(trainer):
            if self._stop_requested:
                raise KeyboardInterrupt("User requested stop")
            # Update epoch immediately when it starts
            cur_epoch = getattr(trainer, "epoch", 0) + 1  # epoch is 0-indexed at start
            total_epochs = getattr(trainer, "epochs", 0)
            self.set_progress(
                current_epoch=int(cur_epoch),
                total_epochs=int(total_epochs),
                message=f"Đang train epoch {cur_epoch}/{total_epochs}..."
            )

        def on_train_batch_end(trainer):
            """Update progress during training - called after each batch."""
            if self._stop_requested:
                raise KeyboardInterrupt("User requested stop")
            
            cur_epoch = getattr(trainer, "epoch", 0) + 1  # Current epoch (1-indexed)
            total_epochs = getattr(trainer, "epochs", 0)
            
            # Get batch progress within epoch
            batch_i = getattr(trainer, "batch", 0) + 1
            nb = getattr(trainer, "nb", 1)  # Number of batches
            
            # Calculate overall percent: epochs progress + batch progress within current epoch
            epoch_progress = (cur_epoch - 1) / total_epochs if total_epochs else 0
            batch_progress = (batch_i / nb) / total_epochs if (total_epochs and nb) else 0
            percent = (epoch_progress + batch_progress) * 100.0
            
            # Get current loss
            train_loss = None
            try:
                train_loss = float(getattr(trainer, "loss", None))
            except Exception:
                pass
            
            # Preserve val_loss from previous epoch end update
            current_val_loss = self.state.get("val_loss")
            
            self.set_progress(
                current_epoch=int(cur_epoch),
                total_epochs=int(total_epochs),
                train_loss=train_loss,
                val_loss=current_val_loss,  # Preserve val_loss
                percent=percent,
            )
            
            # Explicitly yield GIL to allow FastAPI/Uvicorn to process incoming HTTP requests 
            # since workers=0 forces dataloading into the main training thread, blocking the GIL.
            import time
            time.sleep(0.01)

        def on_fit_epoch_end(trainer):
            # epoch is 0-indexed, add 1 for display (1-indexed)
            cur_epoch = getattr(trainer, "epoch", 0) + 1
            total_epochs = getattr(trainer, "epochs", 0)
            
            train_loss, val_loss = None, None
            try:
                train_loss = float(getattr(trainer, "loss", None))
            except Exception: pass
            
            try:
                m = getattr(trainer, "metrics", {})
                if self.ts.task_type == "classification":
                    if isinstance(m, dict):
                        val_loss_raw = m.get("val/loss")
                        val_loss = float(val_loss_raw) if val_loss_raw is not None else None
                
            except Exception: pass
            
            if train_loss is not None: self.metrics_history["train_loss"].append(train_loss)
            
            if self.ts.task_type == "classification":
                if val_loss is not None: self.metrics_history["val_loss"].append(val_loss)
            elif self.ts.task_type == "detection":
                pass

            task_metrics = self._extract_epoch_metrics(trainer, m)
            if self.ts.task_type == "detection":
                if self.metrics_history["val_loss"]:
                    val_loss = self.metrics_history["val_loss"][-1]
                    
            # Use cur_epoch (already 1-indexed) for percent calculation
            percent = (cur_epoch / total_epochs) * 100.0 if total_epochs else 0.0
            try:
                if torch.cuda.is_available():
                    mem_gb = torch.cuda.max_memory_reserved() / (1024 ** 3)
                    if mem_gb > (self.state.get("gpu_mem_max") or 0):
                        self.state["gpu_mem_max"] = float(mem_gb)
            except Exception as e:
                print("DEBUG gpu mem read failed:", e)
            self.set_progress(
                current_epoch=int(cur_epoch),
                total_epochs=int(total_epochs),
                train_loss=train_loss,
                val_loss=val_loss,
                **task_metrics, 
                percent=percent,
                message=f"Epoch {cur_epoch}/{total_epochs} hoàn tất"
            )


        return {
            "on_fit_start": on_fit_start,
            "on_fit_epoch_start": on_fit_epoch_start,
            "on_train_batch_end": on_train_batch_end,
            "on_fit_epoch_end": on_fit_epoch_end,
        }
    @abstractmethod
    def _extract_epoch_metrics(self, trainer, metrics_dict: dict) -> dict:
        pass
    @abstractmethod
    def _resolve_pretrained_ckpt(self):
        pass
        
    # PHƯƠNG THỨC TRỪU TƯỢNG: LẤY BEST METRICS TỪ HISTORY VÀ LỌC KẾT QUẢ CUỐI CÙNG
    @abstractmethod
    def _get_final_result_dict(self, final_res, best_epoch_index) -> dict:
        pass
    def _train_loop(self):
        ckpt_path = self._resolve_pretrained_ckpt()
        
        is_hub_file = Path(ckpt_path).name == ckpt_path 
        
        old_cwd = Path.cwd()
        if is_hub_file:
            try:
                os.chdir(str(settings.MODELS_HUB_DIR))
                model = YOLO(ckpt_path)
            finally:
                os.chdir(old_cwd)
        else:
            model = YOLO(ckpt_path)


        cbs = self._make_yolo_callbacks()
        for name, fn in cbs.items():
            model.add_callback(name, fn)

        imgsz_final = max(self.ts.img_width, self.ts.img_height)

        results = model.train(
            data=self.ts.final_dataset_path, 
            epochs=self.ts.epochs,
            imgsz=imgsz_final,
            lr0=self.ts.lr,
            batch=self.ts.batch_size,
            device=0 if torch.cuda.is_available() else "cpu",
            workers=0,
            deterministic=True,
            verbose=False,
            project=str(self.session_dir), 
            name="runs",                   
            plots=True,
        )
        
        if self._stop_requested:
            return None 

        final_res = results[-1] if isinstance(results, list) else results

        best_epoch_index = self._find_best_epoch_index()
        
        result = self._get_final_result_dict(final_res, best_epoch_index)
        
        result.update(self._cleanup_and_get_common_results(model, final_res))
        
        return result
    def _find_best_epoch_index(self) -> int:
        if self.ts.task_type == "classification":
            metric_history = self.metrics_history.get("val_acc", [])
            return np.argmax(metric_history) if metric_history else 0
        elif self.ts.task_type == "detection":
            metric_history = self.metrics_history.get("mAP_0.5", [])
            return np.argmax(metric_history) if metric_history else 0
        return 0
        
    def _cleanup_and_get_common_results(self, model, final_res) -> dict:
        
        class_names_list = []
        names_dict = None
        if hasattr(model, 'names') and isinstance(model.names, dict):
            names_dict = model.names
        elif hasattr(final_res, 'names') and isinstance(final_res.names, dict):
            names_dict = final_res.names

        if names_dict:
            try:
                sorted_keys = sorted(names_dict.keys())
                class_names_list = [names_dict[k] for k in sorted_keys]
            except Exception as e:
                print(f"Error processing class names: {e}")
        
        confusion_matrix = extract_confusion_matrix_from_results(final_res)

        del model
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        print("Giải phóng model, đợi 2 giây...")
        time.sleep(2)
        
        
        save_dir = Path(getattr(final_res, "save_dir", str(self.session_dir / "runs")))
        best_pt_src = save_dir / "weights" / "best.pt"
        
        if best_pt_src.is_file():
            ckpt_path_to_save = best_pt_src
        else:
            ckpt_path_to_save = self.session_dir / "NO_BEST_WEIGHT_FOUND.txt"
            ckpt_path_to_save.write_text("NO BEST WEIGHT FOUND\n")
        
        gpu_mem_max = extract_max_gpu_mem(save_dir)

        return {
            "confusion_matrix": confusion_matrix,
            "class_names": class_names_list,
            "train_loss_history": self.metrics_history["train_loss"],
            "val_loss_history": self.metrics_history["val_loss"],
            "checkpoint_path": ckpt_path_to_save,
            "gpu_mem_max": gpu_mem_max,
        }
    def _save_results(self, result: dict):
        self.ts.current_epoch = self.ts.epochs
        self.ts.total_epochs = self.ts.epochs
        
        # 1. Lấy giá trị đo realtime (từ torch.cuda đo được trong callback)
        live_gpu_mem = self.state.get("gpu_mem_max")
        
        # 2. Lấy giá trị từ file CSV (nếu có)
        csv_gpu_mem = result.get("gpu_mem_max")

        # 3. Logic ưu tiên: 
        # Nếu CSV có dữ liệu -> dùng CSV. 
        # Nếu CSV là None -> dùng realtime. 
        # Nếu cả 2 đều không có -> None.
        if csv_gpu_mem is not None:
            self.ts.gpu_mem_max = csv_gpu_mem
        else:
            self.ts.gpu_mem_max = live_gpu_mem

        # Các trường khác giữ nguyên
        self.ts.train_loss = result.get("train_loss")
        self.ts.val_loss = result.get("val_loss")
        self.ts.train_loss_history = json.dumps(result.get("train_loss_history"))
        self.ts.val_loss_history = json.dumps(result.get("val_loss_history"))
        self.ts.checkpoint_path = str(result.get("checkpoint_path"))
        self.ts.best_metric_note = result.get("summary_note")
        
        # Xóa dòng gán đè bị lỗi cũ đi
        # self.ts.gpu_mem_max = result.get("gpu_mem_max") 

        if result.get("confusion_matrix") is not None:
            self.ts.confusion_matrix_json = json.dumps(result["confusion_matrix"])
        
        if result.get("class_names") is not None:
            class_names = result.get("class_names")
            if class_names:
                self.ts.class_names_json = json.dumps(class_names)
        
        if self.ts.task_type == "classification":
            self.ts.val_acc = result.get("val_acc")
            self.ts.val_acc_history = json.dumps(result.get("val_acc_history"))
        
        elif self.ts.task_type == "detection":
            self.ts.best_map50 = result.get("best_map50")
            self.ts.detection_metrics_history_json = json.dumps(
                result.get("detection_metrics_history")
            )

        self.ts.status = "finished"
        self.db.commit()
        
        # Update progress lần cuối
        self.set_progress(
            status="finished",
            current_epoch=self.ts.epochs,
            percent=100.0,
            train_loss=self.ts.train_loss,
            val_loss=self.ts.val_loss,
            val_acc=self.ts.val_acc,
            best_map50=self.ts.best_map50,
            gpu_mem_max=self.ts.gpu_mem_max # Cập nhật lại vào state để chắc chắn
        )

    def _handle_error(self, error_code: str, error_message: str) -> bool:
        self.ts.status = "failed"
        self.ts.best_metric_note = error_message
        self.db.commit()
        
        self.set_progress(status="failed", error_message=error_code)
        return False

    def run(self):
        try:
            if not self._prepare_data():
                return 

            ok, reason = self._precheck_resources()
            if not ok:
                self._handle_error(reason, reason)
                return

            self.ts.status = "running"
            self.db.commit()
            self.set_progress(status="running")
            
            try:
                result = self._train_loop()
                
                if result is None:
                    if self._stop_requested:
                        self._handle_error("stopped_by_user", "Training stopped by user.")
                    else:
                        self._handle_error("train_failed", "Training loop failed unexpectedly.")
                    return

            except KeyboardInterrupt: 
                self._handle_error("stopped_by_user", "Training stopped by user.")
                return
            except RuntimeError as e: 
                self._handle_error(f"Training Error: {e}", f"Training Error: {e}")
                return
            except Exception as e:
                self._handle_error(f"Training Core Error: {e}", f"Training Core Error: {e}")
                return

            self._save_results(result)

        except Exception as e:
            if self.ts.status != "finished":
                self._handle_error(f"Unhandled Core Error: {e}", f"Unhandled Core Error: {e}")
