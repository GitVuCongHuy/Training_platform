# backend/task_manager.py
import uuid
from typing import Dict, Any

TASK_STATE: Dict[str, Dict[str, Any]] = {}

def create_task(name: str) -> str:
    task_id = str(uuid.uuid4())
    TASK_STATE[task_id] = {
        "status": "running",
        "name": name,
        "should_cancel": False,
        # Các trường tiến trình chi tiết
        "overall_progress": 0,
        "overall_total": 1,
        "current_class_index": 0,
        "total_classes": 0,
        "current_class_name": "",
        "current_class_progress": 0,
        "completed_classes": {}, # Lưu các class đã hoàn thành
        "message": "Khởi tạo tác vụ..."
    }
    print(f"Task created: {task_id} ({name})")
    return task_id

def update_task_details(task_id: str, details: Dict[str, Any]):
    """Cập nhật chi tiết tiến trình của một tác vụ."""
    if task_id in TASK_STATE:
        TASK_STATE[task_id].update(details)

def get_task_status(task_id: str) -> Dict[str, Any]:
    return TASK_STATE.get(task_id, {"status": "not_found"})

def cancel_task(task_id: str):
    if task_id in TASK_STATE:
        TASK_STATE[task_id]["should_cancel"] = True
        TASK_STATE[task_id]["status"] = "cancelled"
        TASK_STATE[task_id]["message"] = "Đã hủy"
        print(f"Task flagged for cancellation: {task_id}")

def is_task_cancelled(task_id: str) -> bool:
    return TASK_STATE.get(task_id, {}).get("should_cancel", False)

def complete_task(task_id: str):
    if task_id in TASK_STATE:
        print(f"Task completed or cancelled, removing: {task_id}")
        del TASK_STATE[task_id]