# backend/api/change_bg_api.py
from fastapi import APIRouter, BackgroundTasks, Request, HTTPException, Query
from starlette.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, List
import os
import glob

from ..services.generation import change_bg_service
from .. import task_manager

router = APIRouter()

# === MODEL CHO BƯỚC 1 ===
class MaskExtractionRequest(BaseModel):
    input_path: str
    output_path: str
    params: Dict = {}

@router.post("/extract-masks")
async def start_mask_extraction(
    req_body: MaskExtractionRequest,
    background_tasks: BackgroundTasks,
    request: Request
):
    task_id = task_manager.create_task("extract_masks")
    models = request.app.state.models

    if models.get("yolo") is None or models.get("sam") is None:
        raise HTTPException(
            status_code=400,
            detail="Các mô hình AI chưa được tải vào bộ nhớ. Vui lòng vào Cài đặt và tải Models trước khi thực hiện chức năng này."
        )

    background_tasks.add_task(
        change_bg_service.process_mask_extraction_task,
        models=models,
        task_id=task_id,
        input_path=req_body.input_path,
        output_path=req_body.output_path,
        params=req_body.params
    )
    return {"message": "Tác vụ tách mask đã bắt đầu.", "task_id": task_id}


# === MODEL VÀ ENDPOINT MỚI CHO BƯỚC 2 ===
class CompositeRequest(BaseModel):
    mask_path: str
    background_image_path: str
    output_path: str

@router.post("/composite-images")
async def start_compositing(
    req_body: CompositeRequest,
    background_tasks: BackgroundTasks
):
    """
    Bắt đầu tác vụ nền để ghép hàng loạt các mask lên một background.
    """
    task_id = task_manager.create_task("composite_images")
    background_tasks.add_task(
        change_bg_service.process_compositing_task,
        task_id=task_id,
        mask_path=req_body.mask_path,
        background_image_path=req_body.background_image_path,
        output_path=req_body.output_path
    )
    return {"message": "Tác vụ ghép ảnh hàng loạt đã bắt đầu.", "task_id": task_id}

@router.get("/list-images", response_model=List[str])
async def list_images_in_folder(folder_path: str = Query(...)):
    """
    Trả về danh sách đường dẫn tuyệt đối của các file ảnh trong một thư mục.
    """
    if not os.path.isdir(folder_path):
        raise HTTPException(status_code=404, detail="Thư mục không tồn tại.")
    try:
        allowed = (".png", ".jpg", ".jpeg", ".bmp", ".webp")
        files = [os.path.join(folder_path, f) for f in os.listdir(folder_path) if f.lower().endswith(allowed)]
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get-image")
async def get_image_file(path: str = Query(...)):
    """
    Trả về một file ảnh từ một đường dẫn tuyệt đối.
    """
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Ảnh không tồn tại.")
    return FileResponse(path)


class UpdateImageRequest(BaseModel):
    mask_image_path: str
    background_image_path: str
    output_image_path: str
    params: Dict

@router.post("/update-image")
async def update_image(req_body: UpdateImageRequest):
    """
    Cập nhật một ảnh duy nhất với các thông số biến đổi mới.
    """
    result = change_bg_service.update_single_image_transform(
        mask_image_path=req_body.mask_image_path,
        background_image_path=req_body.background_image_path,
        output_image_path=req_body.output_image_path,
        params=req_body.params
    )
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    return result
class UpdateAllImagesRequest(BaseModel):
    mask_dir: str
    background_image_path: str
    output_dir: str
    params: Dict

@router.post("/update-all-images")
async def update_all_images(
    req_body: UpdateAllImagesRequest,
    background_tasks: BackgroundTasks,
):
    """
    Áp dụng cùng bộ params cho TẤT CẢ mask (.png) trong mask_dir,
    ghi kết quả vào output_dir. Chạy nền giống các task khác.
    Trả về task_id ngay lập tức để frontend poll /task-status/{task_id}.
    """


    mask_dir = req_body.mask_dir
    bg_path = req_body.background_image_path
    out_dir = req_body.output_dir
    params = req_body.params

    if not os.path.isdir(mask_dir):
        raise HTTPException(status_code=400, detail="mask_dir không tồn tại.")
    if not os.path.isdir(out_dir):
        raise HTTPException(status_code=400, detail="output_dir không tồn tại.")
    if not os.path.isfile(bg_path):
        raise HTTPException(status_code=400, detail="background_image_path không hợp lệ.")

    mask_files = sorted(glob.glob(os.path.join(mask_dir, "*.png")))
    if not mask_files:
        raise HTTPException(status_code=400, detail="Không tìm thấy mask (.png) nào trong mask_dir.")

    task_id = task_manager.create_task("batch_update_images")

    def _do_batch_update():
        try:
            total_files = len(mask_files)
            task_manager.update_task_details(task_id, {
                "total": total_files,
                "progress": 0,
                "message": f"Chuẩn bị áp dụng cho {total_files} ảnh..."
            })

            for idx, mask_path in enumerate(mask_files):
                if task_manager.is_task_cancelled(task_id):
                    task_manager.update_task_details(task_id, {
                        "message": "Tác vụ đã bị hủy."
                    })
                    break

                base_name = os.path.splitext(os.path.basename(mask_path))[0]
                out_path = os.path.join(out_dir, f"{base_name}.jpg")

                current_progress = idx + 1
                task_manager.update_task_details(task_id, {
                    "progress": current_progress,
                    "message": f"Đang áp dụng {current_progress}/{total_files}: {base_name}"
                })

                change_bg_service.update_single_image_transform(
                    mask_image_path=mask_path,
                    background_image_path=bg_path,
                    output_image_path=out_path,
                    params=params
                )

            task_manager.update_task_details(task_id, {
                "message": "Hoàn tất!",
                "progress": len(mask_files)
            })
        except Exception as e:
            task_manager.update_task_details(task_id, {
                "message": f"Lỗi: {e}"
            })
        finally:
            task_manager.complete_task(task_id)

    background_tasks.add_task(_do_batch_update)

    return {
        "message": "Tác vụ áp dụng hàng loạt đã bắt đầu.",
        "task_id": task_id
    }
