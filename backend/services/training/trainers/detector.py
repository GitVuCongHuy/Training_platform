# backend/services/training/trainers/detector.py
from pathlib import Path
from .base import BaseTrainer
from ....config import settings 

# Hàm hỗ trợ resolve_pretrained_det (giữ nguyên, nhưng trả về path tuyệt đối)
def resolve_pretrained_det(version: str, size: str) -> str:
    clean_version = version.lstrip("v") if version in ("v11", "v12") else version
    hub_dir = Path(settings.MODELS_HUB_DIR)
    hub_dir.mkdir(parents=True, exist_ok=True)
    filename = f"yolo{clean_version}{size}.pt"
    path = hub_dir / filename
    if path.is_file():
        print(f"DEBUG: Using local det model in models_hub: {path}")
        return str(path)
    print(f"DEBUG: Will download det weight to models_hub: {path}")
    return str(path)


class YoloDetectorTrainer(BaseTrainer):
    
    def __init__(self, db, ts):
        super().__init__(db, ts)
        self.metrics_history.update({
            "mAP_0.5": [],
            "mAP_0.5_0.95": [],
            "precision": [],
            "recall": []
        })

    # IMPLEMENT ABSTRACT METHOD: RESOLVE PRETRAINED CKPT
    def _resolve_pretrained_ckpt(self):
        return resolve_pretrained_det(self.ts.model_version, self.ts.model_size)

    # IMPLEMENT ABSTRACT METHOD: TRÍCH XUẤT METRICS RIÊNG BIỆT CHO MỖI EPOCH
    def _extract_epoch_metrics(self, trainer, metrics_dict: dict) -> dict:
        map50, map_all, precision, recall, val_loss_det = None, None, None, None, None
        
        # Logic trích xuất val loss cho detection (tổng 3 loss)
        try:
            val_box_loss = metrics_dict.get("val/box_loss")
            val_cls_loss = metrics_dict.get("val/cls_loss")
            val_dfl_loss = metrics_dict.get("val/dfl_loss")
            
            if val_box_loss is not None and val_cls_loss is not None and val_dfl_loss is not None:
                val_loss_det = float(val_box_loss) + float(val_cls_loss) + float(val_dfl_loss)
                self.metrics_history["val_loss"].append(val_loss_det)
        except Exception: pass
        
        # Trích xuất các metrics khác
        try:
            map50_raw = metrics_dict.get("metrics/mAP50(B)")
            map50 = float(map50_raw) if map50_raw is not None else None
            
            map_all_raw = metrics_dict.get("metrics/mAP50-95(B)")
            map_all = float(map_all_raw) if map_all_raw is not None else None
            
            precision_raw = metrics_dict.get("metrics/Precision(B)")
            precision = float(precision_raw) if precision_raw is not None else None
            
            recall_raw = metrics_dict.get("metrics/Recall(B)")
            recall = float(recall_raw) if recall_raw is not None else None
        except Exception: pass

        if map50 is not None: self.metrics_history["mAP_0.5"].append(map50)
        if map_all is not None: self.metrics_history["mAP_0.5_0.95"].append(map_all)
        if precision is not None: self.metrics_history["precision"].append(precision)
        if recall is not None: self.metrics_history["recall"].append(recall)
        
        return {"best_map50": map50} # Trả về dict để cập nhật self.state (best_map50)


    # IMPLEMENT ABSTRACT METHOD: LẤY KẾT QUẢ CUỐI CÙNG TỪ HISTORY
    def _get_final_result_dict(self, final_res, best_epoch_index) -> dict:
        
        train_loss, val_loss, best_map50 = None, None, None
        try:
            map_history = self.metrics_history["mAP_0.5"]
            if map_history:
                best_map50 = map_history[best_epoch_index]
                if len(self.metrics_history["val_loss"]) > best_epoch_index:
                    val_loss = self.metrics_history["val_loss"][best_epoch_index]
                if len(self.metrics_history["train_loss"]) > best_epoch_index:
                    train_loss = self.metrics_history["train_loss"][best_epoch_index]
        except Exception as e:
            print(f" Error extracting BEST metrics from history: {e}")

        map50_f = best_map50 or 0.0
        summary_note = f"Training completed. Best mAP@0.5: {map50_f:.4f}"

        return {
            "train_loss": train_loss,
            "val_loss": val_loss, 
            "best_map50": best_map50, 
            "detection_metrics_history": self.metrics_history["mAP_0.5"], # mAP@0.5 history
            "detection_metrics_history_full": self.metrics_history, 
            "summary_note": summary_note,
        }

