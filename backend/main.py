# backend/main.py
import shutil
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .database.database import Base, engine
from .database import models
from .config import settings

from .api import gen_ai_api, change_bg_api, training_api, export_api
from . import task_manager
from .services.models import model_loader
from .api import models_api

# Try to import tkinter, but don't crash if not available (server environment)
HAS_GUI = False
try:
    import tkinter as tk
    from tkinter import filedialog
    HAS_GUI = True
except ImportError:
    print("⚠️  tkinter not available - /select-folder endpoint will be disabled")
except Exception as e:
    print(f"⚠️  GUI not available ({e}) - /select-folder endpoint will be disabled")

TEMP_UPLOAD_DIR = Path(__file__).resolve().parent / "storage" / "temp_uploads"
TEMP_UPLOAD_DIR.mkdir(exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 30)
    print("Bắt đầu khởi động ứng dụng và load model...")

    app.state.models = {
        "yolo": None,
        "sam": None
    }

    Base.metadata.create_all(bind=engine)
    print(" DB checked / created")

    print(" Model đã load xong!")
    print("=" * 30)

    yield

    print("=" * 30)
    print("Đang dọn dẹp và tắt ứng dụng...")
    app.state.models.clear()
    print(" Dọn dẹp xong.")
    print("=" * 30)

app = FastAPI(
    title="AI Tool Suite API",
    description="Backend for AI Image Generation, Background Editing, and Training",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(gen_ai_api.router, prefix="/gen-ai", tags=["Gen AI"])
app.include_router(change_bg_api.router, prefix="/change-bg", tags=["Change Background"])
app.include_router(training_api.router, prefix="/train", tags=["Train"])
app.include_router(export_api.router, prefix="/export", tags=["Export"])
app.include_router(models_api.router, prefix="/models", tags=["Models"])
@app.get("/")
def read_root():
    return {"message": "Welcome to the AI Tool Suite Backend!"}

@app.get("/health")
def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "gui_available": HAS_GUI
    }

@app.get("/select-folder")
def select_folder():
    """
    Select folder using GUI file dialog.
    Note: This endpoint only works in local development with GUI support.
    On servers without GUI, this will return an error.
    """
    if not HAS_GUI:
        raise HTTPException(
            status_code=501,
            detail="Folder selection UI not available on this server. "
                   "Please use direct path input or upload files instead."
        )
    
    try:
        print("Received request for /select-folder. Opening dialog...")
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes("-topmost", 1)
        folder_path = filedialog.askdirectory(master=root, title="Chọn thư mục")
        root.destroy()
        print(f"Folder selected: {folder_path}")
        return {"path": folder_path}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to open folder dialog: {str(e)}"
        )

@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """
    Upload file tạm cho Page 1 / Change BG
    """
    try:
        file_path = TEMP_UPLOAD_DIR / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"path": str(file_path.absolute())}
    except Exception as e:
        return {"error": f"Không thể upload file: {e}"}

@app.post("/cancel-task/{task_id}")
async def cancel_any_task(task_id: str):
    task_manager.cancel_task(task_id)
    return {"message": f"Đã gửi yêu cầu hủy cho tác vụ {task_id}."}

@app.get("/task-status/{task_id}")
async def get_task_progress(task_id: str):
    status = task_manager.get_task_status(task_id)
    if status.get("status") == "not_found":
        return {"status": "completed"}
    return status
