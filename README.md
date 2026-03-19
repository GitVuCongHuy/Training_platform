<div align="center">
  <h1>🚀 AI Tool Suite Pro</h1>
  <p><b>Nền tảng Web toàn diện cho Computer Vision & Generative AI</b></p>
  <p><i>FastAPI (Backend) + React/Vite (Frontend) + SQLite</i></p>
</div>

<br />

## 🌟 Giới thiệu (Introduction)
**AI Tool Suite Pro** là một nền tảng web mạnh mẽ được thiết kế để đơn giản hóa workflow làm việc với các mô hình Trí tuệ Nhân tạo (Computer Vision & Gen AI). Thay vì phải code script phức tạp bằng Python, người dùng có thể dễ dàng quản lý dataset, huấn luyện mô hình YOLO (Object Detection/Classification), xóa phông ảnh bằng AI, và tạo ảnh bằng văn bản hoàn toàn thông qua giao diện kéo-thả trực quan.

## ✨ Tính năng nổi bật & Lợi ích (Features & Benefits)

### 1. 🎨 Generative AI & Change Background
- **Text-to-Image Generation**: Tự do sáng tạo hình ảnh từ văn bản bằng mô hình Flux qua API của [Pollinations.ai](https://pollinations.ai). Tùy chỉnh số lượng ảnh, kích thước, hạt giống (seed) dễ dàng.
- **Auto Background Removal (SAM)**: Tự động tách nền cực chuẩn nhờ sức mạnh của **Segment Anything Model (SAM)**. Hỗ trợ xử lý ảnh đơn hoặc xử lý hàng loạt cả thư mục.

### 2. 🧠 Huấn luyện & Kiểm thử YOLO (Train/Test Model)
- **Real-time Training Tracking**: Huấn luyện YOLOv8/v10/v11 (Classification & Detection) trực tiếp trên Web. Theo dõi biểu đồ Loss, Accuracy, mAP theo thời gian thực.
- **Dataset Management**: Cấu trúc thư mục dataset linh hoạt, tự động nhận diện và tính toán thông số.
- **Model Evaluation**: Chạy kiểm thử model sau khi train, xuất ra confusion matrix và các chỉ số đánh giá độ chính xác (Precision/Recall).

### 3. ⚙️ Tối ưu mô hình (Export Model)
- Hỗ trợ convert file `.pt` sang các định dạng tối ưu cho ứng dụng thực tế.
- **ONNX Export**: Cho phép bật tính năng `Simplify graph` và `Dynamic axes` để file nhẹ hơn, chạy mượt trên nhiều thiết bị.
- **TensorRT Export**: Ép kiểu mô hình sang `.engine` (hỗ trợ FP16, INT8) để đạt tốc độ xử lý (inference) bứt phá trên GPU NVIDIA.

---

## 🛠️ Hướng dẫn cài đặt (Setup Guide)

Hệ thống yêu cầu máy tính đã cài đặt sẵn **Python 3.10+** và **Node.js (npm)**.

### Bước 1: Backend (Cấu hình lõi AI)

1. Mở terminal, đi tới thư mục `backend` và tạo môi trường ảo:
```bash
cd backend
python -m venv .venv
```
2. Kích hoạt môi trường:
- **Windows:** `.venv\Scripts\activate`
- **Linux/Mac:** `source .venv/bin/activate`

3. Cài đặt các thư viện lõi:
```bash
pip install -r requirements.txt
```
> **Lưu ý**: Lần chạy đầu tiên, hệ thống sẽ tự động tải các file weights nặng (như `yolov8n.pt` hoặc `sam_vit_h.pth` từ hub) nếu chưa có sẵn. Đảm bảo bạn có kết nối mạng ổn định.

4. Chạy Backend Server:
```bash
python -m uvicorn backend.main:app --reload
```
API của bạn sẽ chạy tại địa chỉ: `http://localhost:8000`

### Bước 2: Frontend (Giao diện người dùng)

1. Mở một terminal khác, trỏ vào thư mục `frontend-vite`:
```bash
cd frontend-vite
```
2. Cài đặt các modules React:
```bash
npm install
```
3. Khởi chạy giao diện:
```bash
npm run dev
```
Trang web sẽ hiện lên tại `http://localhost:5173`. Frontend sẽ tự động nhận diện kết nối với Backend.

---

## ⚠️ Cảnh báo & Trú ý quan trọng (Important Notices)

> [!WARNING]
> ### 1. Key API cho Generative AI
> Chức năng **Gen AI** bắt buộc phải có khóa xác thực (API Key). 
> 1. Truy cập [enter.pollinations.ai](https://enter.pollinations.ai) để lấy Key.
> 2. Điền Key trực tiếp vào giao diện Website để sử dụng. Hoặc thêm vào file `backend/.env` với biến `POLLINATIONS_API_KEY=your_key_here`.

> [!CAUTION]
> ### 2. Tối ưu TensorRT trên Windows
> Tính năng **Export Model sang định dạng TENSORRT** yêu cầu bắt buộc thiết bị phải có **GPU NVIDIA** vật lý và cài sẵn đúng chuẩn CUDA driver.
> - Phiên bản `tensorrt` mặc định trên PyPI không hỗ trợ Windows một cách hoàn hảo. Để dùng được TensorRT trên Windows, bạn **phải gõ cài đặt thủ công** theo hướng dẫn sau:
>   `pip install tensorrt --extra-index-url https://pypi.nvidia.com`
> - Nếu máy tính của bạn chỉ dùng CPU hoặc không setup môi trường NVIDIA đạt chuẩn, quá trình xuất TensorRT sẽ báo lỗi: *"Chưa cài tensorrt cho Python hiện tại"*. Lúc này, vui lòng sử dụng **ONNX**!

> [!NOTE]
> ### 3. Quản lý dung lượng (Storage)
> Các checkpoint nặng, dataset đã tải về không nên được `git commit` để tránh phình to repo. Mọi trọng số mô hình sẽ lưu ở thư mục `backend/models_hub/` và kết quả tạo ảnh/train/export sẽ sinh tự động ở `backend/storage/`. Khi clone project mới về, các thư mục này mặc định là rỗng.

---

## 🏗️ Kiến trúc Project (Cơ bản)
```text
project-root/
├── backend/                  # Logic xử lý AI (Python, FastAPI, Ultralytics, SAM)
│   ├── api/                  # Các Router & Endpoints (REST API)
│   ├── config/               # Biến môi trường & cấu hình lõi
│   ├── database/             # SQLite Models & DB connection
│   ├── services/             # Function thực hiện Train/Export/Sinh ảnh thật sự
│   └── storage/              # Nơi chứa output (session train/ảnh gen/file tải xuống)
└── frontend-vite/            # Giao diện Web Client (React, Vite, MUI)
    ├── src/api/              # Các hàm HTTP fetch tới backend
    └── src/pages/            # Lõi chia Layout và Tabs quản lý
```
