# backend/services/model_loader.py
import gc
import time
import torch
import requests
from tqdm import tqdm
from ultralytics import YOLO
from segment_anything import sam_model_registry, SamPredictor
from ...config import settings

def download_file(url, destination):
    """Tải file với thanh progress."""
    print(f"📥 Model không tồn tại hoặc bị hỏng. Đang tải từ {url}...")
    try:
        with requests.get(url, stream=True) as r:
            r.raise_for_status()
            total_size = int(r.headers.get('content-length', 0))
            with open(destination, 'wb') as f, tqdm(
                desc=destination.name,
                total=total_size,
                unit='iB',
                unit_scale=True,
                unit_divisor=1024,
            ) as bar:
                for chunk in r.iter_content(chunk_size=8192):
                    size = f.write(chunk)
                    bar.update(size)
        print(f"✅ Tải thành công: {destination}")
        return True
    except Exception as e:
        print(f"❌ Lỗi khi tải model: {e}")
        # Xóa file bị tải dở nếu có
        try:
            if destination.exists():
                destination.unlink()
        except:
            pass
        return False

def safe_delete_file(filepath, max_retries=3):
    """Xóa file với retry logic cho trường hợp file bị lock."""
    for attempt in range(max_retries):
        try:
            gc.collect()  # Giải phóng memory để release file handles
            if filepath.exists():
                filepath.unlink()
                return True
        except PermissionError:
            if attempt < max_retries - 1:
                print(f"⏳ File đang bị sử dụng, thử lại sau 1 giây... ({attempt + 1}/{max_retries})")
                time.sleep(1)
            else:
                print(f"❌ Không thể xóa file vì đang bị sử dụng bởi process khác.")
                print(f"💡 Vui lòng tắt tất cả server đang chạy và xóa file thủ công:")
                print(f"   {filepath}")
                return False
    return True

def verify_model_file(filepath):
    """Kiểm tra xem file model có hợp lệ không bằng cách thử load với torch."""
    if not filepath.exists():
        return False, "File không tồn tại"
    
    # Kiểm tra kích thước file (SAM vit_h khoảng 2.4GB)
    file_size_mb = filepath.stat().st_size / (1024 * 1024)
    if file_size_mb < 100:  # Nếu file nhỏ hơn 100MB thì chắc chắn bị lỗi
        return False, f"File quá nhỏ ({file_size_mb:.1f}MB), có thể bị tải dở"
    
    try:
        # Thử load checkpoint để kiểm tra tính toàn vẹn
        torch.load(filepath, map_location='cpu', weights_only=True)
        return True, "OK"
    except Exception as e:
        return False, f"File bị hỏng: {e}"

def get_yolo_model():
    """Tải model YOLO. Thư viện ultralytics sẽ tự xử lý việc download nếu file không tồn tại."""
    print("🔄 Đang tải YOLO model...")
    model = YOLO(settings.YOLO_MODEL_PATH)
    print("✅ YOLO model đã sẵn sàng.")
    return model

def get_sam_predictor():
    """Tải model SAM và khởi tạo predictor. Tự động tải nếu chưa có hoặc file bị hỏng."""
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"🔄 Đang tải SAM model trên thiết bị: {device}")
    
    # Kiểm tra file có tồn tại và hợp lệ không
    need_download = False
    if settings.SAM_CHECKPOINT_PATH.exists():
        print(f"📁 Tìm thấy file checkpoint: {settings.SAM_CHECKPOINT_PATH}")
        is_valid, message = verify_model_file(settings.SAM_CHECKPOINT_PATH)
        
        if not is_valid:
            print(f"⚠️  File checkpoint không hợp lệ: {message}")
            print("🗑️  Đang xóa file hỏng và tải lại...")
            if safe_delete_file(settings.SAM_CHECKPOINT_PATH):
                need_download = True
            else:
                raise RuntimeError(
                    "❌ Không thể xóa file model hỏng. "
                    "Vui lòng tắt tất cả server và xóa file thủ công:\n"
                    f"   {settings.SAM_CHECKPOINT_PATH}"
                )
    else:
        need_download = True
    
    # Tải model nếu cần
    if need_download:
        print(f"📥 SAM model chưa có, đang tải... (khoảng 2.4GB)")
        success = download_file(settings.SAM_DOWNLOAD_URL, settings.SAM_CHECKPOINT_PATH)
        if not success:
            raise RuntimeError("❌ Không thể tải SAM model. Vui lòng kiểm tra kết nối mạng.")
    
    # Load model
    try:
        sam = sam_model_registry[settings.SAM_MODEL_TYPE](checkpoint=settings.SAM_CHECKPOINT_PATH).to(device)
        predictor = SamPredictor(sam)
        print("✅ SAM model đã sẵn sàng.")
        return predictor
    except Exception as e:
        # Nếu vẫn lỗi, xóa file và thông báo
        print(f"❌ Lỗi khi load SAM model: {e}")
        safe_delete_file(settings.SAM_CHECKPOINT_PATH)
        print("🗑️  Đã xóa file hỏng. Vui lòng khởi động lại để tải lại model.")
        raise RuntimeError(f"Không thể load SAM model: {e}")