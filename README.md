# AI Platform — FastAPI + React (Vite) + SQLite

Nền tảng web cho Computer Vision gồm 3 module chính:

1. **Gen AI & Change Background (Page 1)**
2. **Train / Test YOLO Model (Page 2)**
3. **Export Model (Page 3)**


![alt text](image-1.png)
---

## Project Structure
```
project-root/
├── backend/
│ ├── main.py
│ ├── task_manager.py
│ ├── ai_app.db
│ │
│ ├── api/
│ │ ├── gen_ai_api.py
│ │ ├── change_bg_api.py
│ │ ├── training_api.py
│ │ └── export_api.py
│ │
│ ├── config/
│ │ └── settings.py
│ │
│ ├── database/
│ │ ├── database.py
│ │ ├── models.py
│ │ └── crud.py
│ │
│ ├── models_hub/
│ │ └── .gitkeep
│ │
│ ├── services/
│ │ ├── core/
│ │ │ └── model_loader.py
│ │ │
│ │ ├── generation/
│ │ │ ├── gen_ai_service.py
│ │ │ └── change_bg_service.py
│ │ │
│ │ ├── training/
│ │ │ ├── core.py
│ │ │ ├── job_manager.py
│ │ │ ├── service.py
│ │ │ ├── trainers/
│ │ │ │ ├── base.py
│ │ │ │ └── classifier.py
│ │ │ └── utils/
│ │ │ └── dataset.py
│ │ │
│ │ └── export/
│ │ └── export_service.py
│ │
│ └── storage/
│ ├── temp_uploads/
│ ├── training_sessions/
│ ├── testing_sessions/
│ └── manual_exports/
│
└── frontend-vite/
├── index.html
├── vite.config.js
├── package.json
│
└── src/
├── api/
├── components/
│ ├── NavBar.jsx
│ └── TabPanel.jsx
│
└── pages/
├── Home/
├── GenAiPage/
├── TrainModelPage/
└── ExportPage/

```
---

## Backend Setup (FastAPI)

### 1) Create venv & install dependencies

```bash
cd backend
python -m venv .venv
```

**Windows:**
```bash
.venv\Scripts\activate
```

**Linux/Mac:**
```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

> Nếu project yêu cầu thêm torch/torchvision/albumentations/shapely…  
> → Cài thêm theo error `ImportError` cụ thể trên máy bạn.

---

### 2) Configuration

Backend hỗ trợ configuration qua **environment variables** (.env file).

#### Tạo file .env (tùy chọn):

```bash
copy .env.example .env
```

Nếu không tạo `.env`, backend sẽ dùng defaults (localhost, port 8000).

**File `.env` mẫu:**
```env
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:3000
ENVIRONMENT=development
```

> **💡 Tip:** Để chia sẻ qua local network cho team, đổi `BACKEND_HOST=0.0.0.0` và thêm IP máy bạn vào `CORS_ORIGINS`.  
> Chi tiết xem file [DEPLOYMENT.md](DEPLOYMENT.md)

---

### 3) Run backend

```bash
python -m uvicorn backend.main:app --reload ```

Hoặc chỉ định host/port:
```bash
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

DB: backend/ai_app.db

Checkpoints:
backend/models_hub/yolo11x.pt
backend/models_hub/sam_vit_h_4b8939.pth


Backend sẽ tự động:

- tạo DB nếu chưa có
- tạo các folder storage
- tải SAM checkpoint nếu thiếu

---

### 3) Run backend

uvicorn main:app --reload --host 0.0.0.0 --port 8000


**Docs:**

- Swagger UI → http://localhost:8000/docs  
- OpenAPI JSON → http://localhost:8000/openapi.json

---

## Frontend Setup (React + Vite)

### 1) Install dependencies

```bash
cd frontend-vite
npm install
```

### 2) Configuration (tùy chọn)

Frontend tự động detect backend URL. Nếu muốn override:

```bash
copy .env.example .env
```

**File `.env` mẫu:**
```env
VITE_API_URL=http://localhost:8000
```

### 3) Run dev server

```bash
npm run dev
```

Frontend chạy tại: `http://localhost:5173`

> **💡 Tip:** Vite tự động expose qua LAN. Team members cùng mạng có thể truy cập qua IP máy bạn.

### 4) Build production

```bash
npm run build
```
---

## Frontend ↔ Backend Connection

Frontend tự động kết nối với backend thông qua:

**File:** `frontend-vite/src/config.js`

Config tự động detect:
1. Environment variable `VITE_API_URL` (từ .env)
2. Auto-detect từ current hostname (production)
3. Fallback to `http://localhost:8000` (development)

**Override bằng .env:**
```env
VITE_API_URL=http://192.168.1.100:8000
```

---

## API Endpoints

Backend mount router theo backend/main.py:

/gen-ai                # Gen AI
/change-bg             # Change Background
/train                 # Train/Test YOLO
/export                # Export Model

/task-status/{id}      # Task progress
/cancel-task/{id}      # Cancel task
/upload-image          # Upload ảnh tạm
/select-folder         # Chọn folder bằng dialog OS (local only)

Chi tiết endpoint nằm trong backend/api/*.py.
Dataset Format (YOLO)
Classification

dataset/
  train/
    class_a/
    class_b/
  val/
    class_a/
    class_b/
  test/ (optional)

Detection

dataset/
  train/
    images/
    labels/
  val/
    images/
    labels/
  test/ (optional)

How To Use (UI Guide)
Page 1 — Gen AI

    Nhập prompt hoặc chọn class.

    Bấm Generate.

    Theo dõi task realtime.

    Ảnh lưu trong backend/storage/....

Page 1 — Change Background

    Upload ảnh hoặc chọn folder ảnh.

    Chọn background.

    Bấm Start Change BG.

    Theo dõi tiến trình.

    Kết quả xuất ra trong storage.

Page 2 — Train Model

Train New Model

    Chọn task type: classification / detection.

    Chọn dataset path.

    Chọn YOLO model (v8/v10/v11 – n/s/m/l/x).

    Set hyperparameters.

    Bấm Start Training.

    Theo dõi realtime loss/acc/mAP.

    Kết quả lưu theo session.

Test Model

    Chọn session/model.

    Chọn test folder.

    Xem confusion matrix / metrics.

Page 3 — Export Model

    Upload .pt.

    Chọn định dạng export.

    Bấm Export.

    Tải artifact trong storage.

Common Issues

### 1) CORS error

**Giải pháp:** Thêm frontend URL vào `backend/.env`:

```env
CORS_ORIGINS=http://localhost:5173,http://192.168.1.100:5173
```

Restart backend sau khi sửa.

### 2) Frontend không connect được Backend

**Giải pháp:** Set `VITE_API_URL` trong `frontend-vite/.env`:

```env
VITE_API_URL=http://192.168.1.100:8000
```

Rebuild: `npm run build` (production) hoặc restart dev server.

### 3) `/select-folder` lỗi trên server

**Giải pháp:** Endpoint này cần GUI, không hoạt động trên server.
- Dùng text input để nhập path
- Hoặc upload files qua `/upload-image`

### 4) Weight nặng

Không commit `.pt` / `.pth`. Lưu trong `backend/models_hub/`.

### 5) SQLite locked

Đóng các tool đang mở DB (DB Browser / VSCode extension).

### 6) Không có GPU

Backend tự chuyển sang CPU.

---

## 🚀 Deployment Guide

Xem hướng dẫn chi tiết về deployment (local network sharing, production server) trong:

**[DEPLOYMENT.md](DEPLOYMENT.md)**
