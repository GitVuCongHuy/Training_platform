# backend/services/change_bg_service.py
import os
import cv2
import numpy as np
import math
from ... import task_manager

def clip_box(box, w, h):
    x1, y1, x2, y2 = map(int, box)
    x1 = max(0, min(x1, w - 1))
    x2 = max(0, min(x2, w - 1))
    y1 = max(0, min(y1, h - 1))
    y2 = max(0, min(y2, h - 1))
    if x2 <= x1 or y2 <= y1:
        return None
    return np.array([x1, y1, x2, y2], dtype=int)

def box_area(box):
    x1, y1, x2, y2 = box
    return max(0, x2 - x1) * max(0, y2 - y1)

def iou_box(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)
    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)
    inter = inter_w * inter_h
    union = box_area(a) + box_area(b) - inter
    return inter / union if union > 0 else 0.0

def union_box(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    return np.array([min(ax1, bx1), min(ay1, by1), max(ax2, bx2), max(ay2, by2)], dtype=int)

def merge_boxes_by_iou(boxes, thr, w, h):
    boxes = [b for b in boxes]
    changed = True
    while changed and len(boxes) > 1:
        changed = False
        merged = []
        used = [False] * len(boxes)
        for i in range(len(boxes)):
            if used[i]:
                continue
            cur = boxes[i]
            for j in range(i + 1, len(boxes)):
                if used[j]:
                    continue
                if iou_box(cur, boxes[j]) >= thr:
                    cur = union_box(cur, boxes[j])
                    used[j] = True
                    changed = True
            used[i] = True
            cur = clip_box(cur, w, h)
            if cur is not None:
                merged.append(cur)
        boxes = merged
    return boxes

def composite_with_alpha(bg_bgr, fg_bgr, alpha_01):
    a3 = np.dstack([alpha_01]*3).astype(np.float32)
    out = a3 * fg_bgr.astype(np.float32) + (1.0 - a3) * bg_bgr.astype(np.float32)
    return out.astype(np.uint8)

# ===== LOGIC BƯỚC 1 =====
def extract_and_save_mask_for_single_image(
    models: dict,
    input_image_path: str,
    output_png_path: str,
    params: dict
):
    YOLO_CONF = float(params.get('yolo_conf', 0.25))
    IOU_MERGE_THR = float(params.get('iou_merge_thr', 0.5))
    yolo_model = models["yolo"]
    sam_predictor = models["sam"]
    img_bgr = cv2.imread(input_image_path)
    if img_bgr is None:
        print(f"  [Lỗi] Không thể đọc ảnh: {input_image_path}")
        return False
    H, W, _ = img_bgr.shape
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    results = yolo_model(img_rgb, conf=YOLO_CONF, verbose=False)
    boxes = [clip_box(box.xyxy[0].cpu().numpy(), W, H) for box in results[0].boxes if int(box.cls) == 0]
    boxes = [b for b in boxes if b is not None]
    if not boxes:
        print(f"  [Info] Không tìm thấy người trong ảnh: {os.path.basename(input_image_path)}")
        return False
    sam_predictor.set_image(img_rgb)
    combined_mask = np.zeros((H, W), dtype=np.uint8)
    work_boxes = merge_boxes_by_iou(boxes, IOU_MERGE_THR, W, H)
    for b in work_boxes:
        masks, _, _ = sam_predictor.predict(box=b, multimask_output=False)
        combined_mask = np.maximum(combined_mask, masks[0].astype(np.uint8))
    alpha_channel = combined_mask * 255
    img_bgra = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2BGRA)
    img_bgra[:, :, 3] = alpha_channel
    cv2.imwrite(output_png_path, img_bgra)
    return True

def process_mask_extraction_task(
    models: dict,
    task_id: str,
    input_path: str,
    output_path: str,
    params: dict
):
    print(f"Bắt đầu tác vụ Tách Mask: {task_id}")
    try:
        os.makedirs(output_path, exist_ok=True)
        allowed = (".png", ".jpg", ".jpeg", ".bmp")
        files = [f for f in os.listdir(input_path) if f.lower().endswith(allowed)]
        if not files:
            print("Không tìm thấy ảnh nào trong thư mục input.")
            task_manager.update_task_details(task_id, {"message": "Không tìm thấy ảnh."})
            return
        total_files = len(files)
        print(f"[INFO] Tác vụ {task_id}: Sẽ xử lý {total_files} ảnh.")
        task_manager.update_task_details(task_id, {"total": total_files, "progress": 0, "message": f"Chuẩn bị xử lý {total_files} ảnh..."})
        for idx, fname in enumerate(files):
            if task_manager.is_task_cancelled(task_id):
                print(f"Tác vụ {task_id} đã bị hủy.")
                task_manager.update_task_details(task_id, {"message": "Tác vụ đã bị hủy."})
                break
            current_progress = idx + 1
            task_manager.update_task_details(task_id, {
                "progress": current_progress,
                "message": f"Đang xử lý ảnh {current_progress}/{total_files}: {fname}"
            })
            print(f"\n{'='*10} Tác vụ {task_id}: [{current_progress}/{total_files}] {fname} {'='*10}")
            in_path = os.path.join(input_path, fname)
            out_path = os.path.join(output_path, f"{os.path.splitext(fname)[0]}.png")
            success = extract_and_save_mask_for_single_image(models, in_path, out_path, params)
            if success:
                print(f"  [Thành công] Đã lưu mask vào: {os.path.abspath(out_path)}")
            else:
                 print(f"  [Bỏ qua] Không xử lý được ảnh: {fname}")
        print(f"\n Tác vụ {task_id} đã hoàn tất!")
        task_manager.update_task_details(task_id, {"message": "Hoàn tất!", "progress": total_files})
    except Exception as e:
        print(f"Đã có lỗi xảy ra trong tác vụ {task_id}: {e}")
        task_manager.update_task_details(task_id, {"message": f"Lỗi: {e}"})
    finally:
        task_manager.complete_task(task_id)

# ===== LOGIC BƯỚC 2 =====
def composite_single_image(mask_path: str, background_bgr: np.ndarray, output_jpg_path: str):
    mask_bgra = cv2.imread(mask_path, cv2.IMREAD_UNCHANGED)
    if mask_bgra is None:
        print(f"  [Lỗi] Không thể đọc file mask: {mask_path}")
        return False
    H, W, channels = mask_bgra.shape
    if channels < 4:
        print(f"  [Lỗi] File mask không có kênh alpha: {mask_path}")
        return False
    bg_resized = cv2.resize(background_bgr, (W, H))
    fg_bgr = mask_bgra[:, :, :3]
    alpha_channel = mask_bgra[:, :, 3]
    alpha_normalized = alpha_channel.astype(np.float32) / 255.0
    final_image = composite_with_alpha(bg_resized, fg_bgr, alpha_normalized)
    cv2.imwrite(output_jpg_path, final_image)
    return True

def process_compositing_task(
    task_id: str,
    mask_path: str,
    background_image_path: str,
    output_path: str
):
    print(f"Bắt đầu tác vụ Ghép Hàng Loạt: {task_id}")
    try:
        os.makedirs(output_path, exist_ok=True)
        background_bgr = cv2.imread(background_image_path)
        if background_bgr is None:
            raise ValueError(f"Không thể đọc ảnh background: {background_image_path}")
        mask_files = [f for f in os.listdir(mask_path) if f.lower().endswith(".png")]
        if not mask_files:
            print("Không tìm thấy file mask (.png) nào trong thư mục.")
            task_manager.update_task_details(task_id, {"message": "Không tìm thấy mask."})
            return
        total_files = len(mask_files)
        print(f"[INFO] Tác vụ {task_id}: Sẽ xử lý {total_files} mask.")
        task_manager.update_task_details(task_id, {"total": total_files, "progress": 0, "message": f"Chuẩn bị ghép {total_files} ảnh..."})
        for idx, fname in enumerate(mask_files):
            if task_manager.is_task_cancelled(task_id):
                print(f"Tác vụ {task_id} đã bị hủy.")
                task_manager.update_task_details(task_id, {"message": "Tác vụ đã bị hủy."})
                break
            current_progress = idx + 1
            task_manager.update_task_details(task_id, {
                "progress": current_progress,
                "message": f"Đang ghép ảnh {current_progress}/{total_files}: {fname}"
            })
            print(f"\n{'='*10} Tác vụ {task_id}: [{current_progress}/{total_files}] {fname} {'='*10}")
            in_mask_path = os.path.join(mask_path, fname)
            out_jpg_path = os.path.join(output_path, f"{os.path.splitext(fname)[0]}.jpg")
            success = composite_single_image(in_mask_path, background_bgr, out_jpg_path)
            if success:
                print(f"  [Thành công] Đã lưu ảnh ghép vào: {os.path.abspath(out_jpg_path)}")
            else:
                print(f"  [Bỏ qua] Không xử lý được mask: {fname}")
        print(f"\n Tác vụ {task_id} đã hoàn tất!")
        task_manager.update_task_details(task_id, {"message": "Hoàn tất!", "progress": total_files})
    except Exception as e:
        print(f"Đã có lỗi xảy ra trong tác vụ {task_id}: {e}")
        task_manager.update_task_details(task_id, {"message": f"Lỗi: {e}"})
    finally:
        task_manager.complete_task(task_id)

def transform_image_and_mask_3d(image, mask, scale, pitch, yaw, roll, translateX, translateY, W, H):
    pitch = math.radians(pitch)
    yaw = math.radians(yaw)
    roll = math.radians(roll)
    points_3d_origin = np.float32([[-W/2, -H/2, 0], [W/2, -H/2, 0], [W/2, H/2, 0], [-W/2, H/2, 0]])
    src_points_2d = np.float32([[0, 0], [W, 0], [W, H], [0, H]])
    Rx = np.array([[1, 0, 0], [0, math.cos(pitch), -math.sin(pitch)], [0, math.sin(pitch), math.cos(pitch)]])
    Ry = np.array([[math.cos(yaw), 0, math.sin(yaw)], [0, 1, 0], [-math.sin(yaw), 0, math.cos(yaw)]])
    Rz = np.array([[math.cos(roll), -math.sin(roll), 0], [math.sin(roll), math.cos(roll), 0], [0, 0, 1]])
    R = Rz @ Ry @ Rx
    rotated_points_3d = (R @ points_3d_origin.T).T
    focal_length = W * 1.5
    dst_points_2d = np.zeros((4, 2), dtype=np.float32)
    for i in range(4):
        z = rotated_points_3d[i, 2]
        projection_scale = focal_length / (focal_length - z) if (focal_length - z) != 0 else 1
        dst_points_2d[i, 0] = rotated_points_3d[i, 0] * projection_scale + W / 2
        dst_points_2d[i, 1] = rotated_points_3d[i, 1] * projection_scale + H / 2
    center = np.array([W/2, H/2], dtype=np.float32)
    dst_points_2d = center + scale * (dst_points_2d - center)
    M = cv2.getPerspectiveTransform(src_points_2d, dst_points_2d)
    M[0, 2] += translateX
    M[1, 2] += translateY
    transformed_image = cv2.warpPerspective(image, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0,0))
    transformed_mask = cv2.warpPerspective(mask, M, (W, H), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    return transformed_image, transformed_mask

# --- HÀM LÀM MỊN BIÊN MASK ---
def feather_alpha_from_mask(mask_uint8, sigma=2.0):
    alpha = cv2.GaussianBlur((mask_uint8 * 255).astype(np.uint8), (0, 0), sigmaX=sigma, sigmaY=sigma).astype(np.float32) / 255.0
    alpha = np.clip(alpha, 0.0, 1.0)
    return alpha

def update_single_image_transform(
    mask_image_path: str,
    background_image_path: str,
    output_image_path: str,
    params: dict
):
    try:
        SCALE = float(params.get('scale', 1.0))
        PITCH = float(params.get('pitch', 0.0))
        YAW = float(params.get('yaw', 0.0))
        ROLL = float(params.get('roll', 0.0))
        TRANSLATE_X = float(params.get('translateX', 0.0))
        TRANSLATE_Y = float(params.get('translateY', 0.0))
        GAUSS_SIGMA = float(params.get('gauss_sigma', 1.0))
        
        # Đọc ảnh
        background_bgr = cv2.imread(background_image_path)
        mask_bgra = cv2.imread(mask_image_path, cv2.IMREAD_UNCHANGED)

        if background_bgr is None: raise ValueError("Không thể đọc ảnh background.")
        if mask_bgra is None: raise ValueError("Không thể đọc ảnh mask.")
        
        H, W, _ = mask_bgra.shape
        bg_resized = cv2.resize(background_bgr, (W, H))

        # Tách mask nhị phân từ kênh alpha của file PNG
        binary_mask = (mask_bgra[:, :, 3] > 0).astype(np.uint8)

        # Áp dụng biến đổi 3D
        transformed_fg_bgra, transformed_mask = transform_image_and_mask_3d(
            mask_bgra, binary_mask, SCALE, PITCH, YAW, ROLL, TRANSLATE_X, TRANSLATE_Y, W, H
        )
        
        transformed_fg_bgr = transformed_fg_bgra[:, :, :3]
        
        # Làm mịn biên mask sau khi biến đổi
        alpha = feather_alpha_from_mask(transformed_mask, sigma=GAUSS_SIGMA)
        
        # Ghép ảnh và lưu (ghi đè)
        final_image = composite_with_alpha(bg_resized, transformed_fg_bgr, alpha)
        cv2.imwrite(output_image_path, final_image)
        
        return {"status": "success", "path": output_image_path}
    except Exception as e:
        print(f"Lỗi khi cập nhật ảnh: {e}")
        return {"status": "error", "message": str(e)}