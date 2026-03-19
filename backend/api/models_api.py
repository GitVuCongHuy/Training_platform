# backend/api/models_api.py
from fastapi import APIRouter, BackgroundTasks, Request, HTTPException
from pydantic import BaseModel
import psutil
import torch
import shutil
import gc
from typing import Dict, Any

from .. import task_manager
from ..services.models import model_loader
from ..config import settings

router = APIRouter()

# --- Hardware Check Configurations ---
# Minimum required RAM and VRAM (in MB)
MIN_RAM_REQUIRED_MB = 8000  # 8 GB recommended for stable system overall
MIN_VRAM_REQUIRED_MB = 3000 # 3 GB VRAM for SAM+YOLO (lowered to accommodate 4GB GPUs where Windows uses ~1GB)
# Approx disk space for models
# SAM vit-h = ~2.4 GB, YOLO11x = ~110 MB. Total ~ 2.6GB -> 3000 MB safety
MIN_DISK_REQUIRED_MB = 3000

@router.get("/hardware-check")
async def check_hardware() -> Dict[str, Any]:
    """Check system RAM, Disk, and VRAM before loading models."""
    # RAM Check
    vm = psutil.virtual_memory()
    total_ram_mb = vm.total / (1024 * 1024)
    available_ram_mb = vm.available / (1024 * 1024)

    # Disk Check (assuming models_hub dir or current backend dir)
    disk_usage = shutil.disk_usage(settings.MODELS_HUB_DIR if settings.MODELS_HUB_DIR.exists() else ".")
    free_disk_mb = disk_usage.free / (1024 * 1024)

    # VRAM Check (if CUDA available)
    total_vram_mb = 0
    free_vram_mb = 0
    cuda_available = torch.cuda.is_available()
    
    if cuda_available:
        try:
            # torch.cuda.mem_get_info() returns (free, total) in bytes
            free_bytes, total_bytes = torch.cuda.mem_get_info()
            total_vram_mb = total_bytes / (1024 * 1024)
            free_vram_mb = free_bytes / (1024 * 1024)
        except Exception:
            pass

    warnings = []
    
    # Check if models exist on disk already to adjust disk requirement
    models_exist = settings.SAM_CHECKPOINT_PATH.exists() and settings.YOLO_MODEL_PATH.exists()
    disk_requirement = 0 if models_exist else MIN_DISK_REQUIRED_MB

    if free_disk_mb < disk_requirement:
        warnings.append(f"Available disk space ({free_disk_mb:.0f}MB) may not be enough to load models (needs {disk_requirement}MB).")
    
    if available_ram_mb < (MIN_RAM_REQUIRED_MB / 2): # Warning if available RAM is very low
        warnings.append(f"System RAM is critically low ({available_ram_mb:.0f}MB available).")

    if cuda_available and free_vram_mb < MIN_VRAM_REQUIRED_MB:
        warnings.append(f"Low GPU VRAM ({free_vram_mb:.0f}MB) may cause slowness or errors (recommended: {MIN_VRAM_REQUIRED_MB}MB).")
    if not cuda_available:
        warnings.append("System is using CPU instead of GPU. Processing will be slow.")

    return {
        "status": "warning" if len(warnings) > 0 else "ok",
        "warnings": warnings,
        "models_exist": models_exist,
        "hardware": {
            "ram": {"total_mb": total_ram_mb, "available_mb": available_ram_mb},
            "disk": {"free_mb": free_disk_mb},
            "gpu": {
                "available": cuda_available,
                "total_vram_mb": total_vram_mb,
                "free_vram_mb": free_vram_mb,
                "name": torch.cuda.get_device_name(0) if cuda_available else "N/A"
            }
        }
    }

@router.get("/status")
async def get_models_status(request: Request) -> Dict[str, Any]:
    """Check if YOLO and SAM models are currently loaded in memory."""
    models = getattr(request.app.state, "models", {})
    is_yolo_loaded = models.get("yolo") is not None
    is_sam_loaded = models.get("sam") is not None
    
    return {
        "yolo_loaded": is_yolo_loaded,
        "sam_loaded": is_sam_loaded,
        "all_loaded": is_yolo_loaded and is_sam_loaded,
        "models_exist_on_disk": settings.SAM_CHECKPOINT_PATH.exists() and settings.YOLO_MODEL_PATH.exists()
    }

@router.post("/load")
async def load_models(request: Request, background_tasks: BackgroundTasks):
    """Trigger background task to load YOLO and SAM."""
    task_id = task_manager.create_task("load_models")
    
    def _do_load_models():
        try:
            task_manager.update_task_details(task_id, {"progress": 10, "message": "Starting YOLO model download..."})
            
            # Khởi tạo state models nếu chưa có
            if not hasattr(request.app.state, "models"):
                request.app.state.models = {}

            # Load YOLO
            if request.app.state.models.get("yolo") is None:
                yolo_model = model_loader.get_yolo_model()
                request.app.state.models["yolo"] = yolo_model
            
            task_manager.update_task_details(task_id, {"progress": 50, "message": "Starting SAM model download (may take time if downloading from internet)..."})
            
            # Load SAM
            if request.app.state.models.get("sam") is None:
                sam_predictor = model_loader.get_sam_predictor()
                request.app.state.models["sam"] = sam_predictor
            
            task_manager.update_task_details(task_id, {
                "progress": 100, 
                "message": "AI Models (YOLO, SAM) loaded successfully."
            })
        except Exception as e:
            task_manager.update_task_details(task_id, {
                "message": f"Error loading models: {e}"
            })
        finally:
            task_manager.complete_task(task_id)

    background_tasks.add_task(_do_load_models)
    
    return {
        "message": "Model loading process has been placed in the background.",
        "task_id": task_id
    }

@router.post("/unload")
async def unload_models(request: Request):
    """Unload models from memory to free up resources."""
    if hasattr(request.app.state, "models"):
        # Xóa references tới models
        request.app.state.models["yolo"] = None
        request.app.state.models["sam"] = None
        
        # Gọi Garbage Collector để ép Python dọn RAM
        gc.collect()
        
        # Nếu dùng GPU, dọn VRAM của PyTorch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
    return {"message": "AI models unloaded from memory successfully."}

