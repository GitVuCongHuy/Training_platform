# backend/services/training/trainers/classifier.py
from pathlib import Path
from ....config import settings
from .base import BaseTrainer 

# Hàm hỗ trợ resolve_pretrained_cls 
def resolve_pretrained_cls(version: str, size: str) -> str:
    clean_version = version.lstrip("v") if version in ("v11", "v12") else version
    hub_dir = Path(settings.MODELS_HUB_DIR)
    hub_dir.mkdir(parents=True, exist_ok=True)
    filename_cls = f"yolo{clean_version}{size}-cls.pt"
    path_cls = hub_dir / filename_cls
    if path_cls.is_file():
        print(f"DEBUG: Using local cls model in models_hub: {path_cls}")
        return filename_cls
    print(f"DEBUG: cls weight not found, will download to models_hub: {path_cls}")
    return filename_cls


class YoloClassifierTrainer(BaseTrainer):

    def __init__(self, db, ts):
        super().__init__(db, ts)
        # THÊM METRICS RIÊNG VÀO HISTORY
        self.metrics_history["val_acc"] = []

    # IMPLEMENT ABSTRACT METHOD: RESOLVE PRETRAINED CKPT
    def _resolve_pretrained_ckpt(self):
        return resolve_pretrained_cls(self.ts.model_version, self.ts.model_size)
        
    # IMPLEMENT ABSTRACT METHOD: TRÍCH XUẤT METRICS RIÊNG BIỆT CHO MỖI EPOCH
    def _extract_epoch_metrics(self, trainer, metrics_dict: dict) -> dict:
        val_acc = None
        try:
            val_acc_raw = metrics_dict.get("metrics/accuracy_top1")
            val_acc = float(val_acc_raw) if val_acc_raw is not None else None
        except Exception:
            pass
            
        if val_acc is not None: 
            self.metrics_history["val_acc"].append(val_acc)
            
        return {"val_acc": val_acc} # Trả về dict để cập nhật self.state

    # IMPLEMENT ABSTRACT METHOD: LẤY KẾT QUẢ CUỐI CÙNG TỪ HISTORY
    def _get_final_result_dict(self, final_res, best_epoch_index) -> dict:
        
        train_loss, val_loss, val_acc = None, None, None
        try:
            acc_history = self.metrics_history["val_acc"]
            if acc_history:
                val_acc = acc_history[best_epoch_index]
                if len(self.metrics_history["val_loss"]) > best_epoch_index:
                    val_loss = self.metrics_history["val_loss"][best_epoch_index]
                if len(self.metrics_history["train_loss"]) > best_epoch_index:
                    train_loss = self.metrics_history["train_loss"][best_epoch_index]
        except Exception as e:
            print(f"Error extracting BEST metrics from history: {e}")

        val_acc_f = val_acc or 0.0
        summary_note = f"Training completed. Best Val Accuracy: {val_acc_f:.4f}"
        
        return {
            "train_loss": train_loss,
            "val_loss": val_loss,
            "val_acc": val_acc,
            "val_acc_history": self.metrics_history["val_acc"],
            "summary_note": summary_note,
        }

