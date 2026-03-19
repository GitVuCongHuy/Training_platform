import os
from pathlib import Path

# Load environment variables from .env file if it exists
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"Loaded environment from {env_path}")
    else:
        print(f"No .env file found, using defaults")
except ImportError:
    print("python-dotenv not installed, using defaults")

BASE_DIR = Path(__file__).resolve().parent.parent

# === Server Configuration ===
BACKEND_HOST = os.getenv("BACKEND_HOST", "127.0.0.1")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# CORS Origins - comma-separated list
CORS_ORIGINS_STR = os.getenv(
    "CORS_ORIGINS", 
    "http://localhost:5173,http://localhost:5174,http://localhost:3000"
)
CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS_STR.split(",")]

# === Database ===
DATABASE_URL = f"sqlite:///{BASE_DIR / 'ai_app.db'}"

# === Model Paths ===
MODELS_HUB_DIR = BASE_DIR / "models_hub"
YOLO_MODEL_PATH = MODELS_HUB_DIR / "yolo11x.pt" 
SAM_CHECKPOINT_PATH = MODELS_HUB_DIR / "sam_vit_h_4b8939.pth"
SAM_MODEL_TYPE = "vit_h"

SAM_DOWNLOAD_URL = "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth"

MODELS_HUB_DIR.mkdir(parents=True, exist_ok=True)

# === Storage chung ===
STORAGE_DIR = BASE_DIR / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

TRAINING_SESSIONS_DIR = STORAGE_DIR / "training_sessions"
TRAINING_SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

# Chia riêng classify / detect
TRAINING_OUTPUT_DIR_CLS = TRAINING_SESSIONS_DIR / "classify"
TRAINING_OUTPUT_DIR_CLS.mkdir(parents=True, exist_ok=True)

TRAINING_OUTPUT_DIR_DET = TRAINING_SESSIONS_DIR / "detect"
TRAINING_OUTPUT_DIR_DET.mkdir(parents=True, exist_ok=True)

# Print configuration on startup (helpful for debugging)
if ENVIRONMENT == "development":
    print(f"Environment: {ENVIRONMENT}")
    print(f"Backend: {BACKEND_HOST}:{BACKEND_PORT}")
    print(f"CORS Origins: {CORS_ORIGINS}")

