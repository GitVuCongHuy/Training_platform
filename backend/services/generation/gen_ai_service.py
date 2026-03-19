# backend/services/gen_ai_service.py
import os
import random
import httpx
import asyncio
from urllib.parse import quote
import json
from sqlalchemy.orm import Session
from ...database import crud
from ... import task_manager

async def generate_images_for_classes(db: Session, task_id: str, classes_data: list, output_path: str, num_images_per_class: int = 500, api_key: str = ""):
    print(f"Starting Gen AI task: {task_id}")
    base_url = "https://gen.pollinations.ai/image/"
    
    valid_classes = [c for c in classes_data if c.get('name') and c.get('prompt')]
    total_classes = len(valid_classes)
    total_images_to_gen = total_classes * num_images_per_class
    overall_images_generated = 0
    completed_classes_summary = {}

    task_manager.update_task_details(task_id, {
        "total_classes": total_classes,
        "overall_total": total_images_to_gen,
        "num_images_per_class": num_images_per_class
    })
    
    classes_data_json = json.dumps(classes_data)
    crud.create_history_entry(db=db, classes_data=classes_data_json, output_path=output_path)

    # Build headers with API key authentication
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
        print(f"Task {task_id}: Using API key (length={len(api_key)}, prefix={api_key[:6]}...)")
    else:
        print(f"Task {task_id}: WARNING - No API key provided!")

    try:
        async with httpx.AsyncClient(timeout=90.0, headers=headers) as client:
            for idx, class_item in enumerate(valid_classes):
                if task_manager.is_task_cancelled(task_id):
                    break

                class_name = class_item['name']
                prompt = class_item['prompt']
                
                save_dir = os.path.join(output_path, class_name)
                os.makedirs(save_dir, exist_ok=True)
                
                current_class_images_generated = 0
                for i in range(num_images_per_class):
                    if task_manager.is_task_cancelled(task_id):
                        break

                    task_manager.update_task_details(task_id, {
                        "overall_progress": overall_images_generated,
                        "current_class_index": idx + 1,
                        "current_class_name": class_name,
                        "current_class_progress": current_class_images_generated, 
                        "message": f"Đang xử lý class {idx+1}/{total_classes}"
                    })
                    
                    file_index = 0
                    while True:
                        out_path = os.path.join(save_dir, f"{class_name}_{file_index}.png")
                        if not os.path.exists(out_path): break
                        file_index += 1

                    seed = random.randint(0, 999999)
                    params = {"width": 640, "height": 360, "seed": seed, "model": "flux"}
                    # Also pass API key as query param for GET endpoints
                    if api_key:
                        params["key"] = api_key
                    url = base_url + quote(prompt)
                    
                    success = False
                    for attempt in range(3):
                        if task_manager.is_task_cancelled(task_id):
                            break
                        try:
                            response = await client.get(url, params=params)
                            response.raise_for_status()
                            with open(out_path, "wb") as f: f.write(response.content)
                            print(f"Task {task_id}: Image {file_index} ({class_name}) saved.")
                            success = True
                            break
                        except httpx.HTTPStatusError as e:
                            error_body = e.response.text[:200] if e.response else "No response"
                            print(f"Task {task_id}: HTTP {e.response.status_code} on image {file_index}, attempt {attempt+1}: {error_body}")
                            await asyncio.sleep(5)
                        except Exception as e:
                            print(f"Task {task_id}: Error on image {file_index}, attempt {attempt+1}: {e}")
                            await asyncio.sleep(5)
                    
                    if success:
                        overall_images_generated += 1
                        current_class_images_generated += 1
                    else:
                        print(f"Task {task_id}: Skipped image {file_index} ({class_name}).")
                    
                    await asyncio.sleep(0.1)
                
                if task_manager.is_task_cancelled(task_id):
                    break
                
                completed_classes_summary[class_name] = current_class_images_generated
                task_manager.update_task_details(task_id, {"completed_classes": completed_classes_summary.copy()})

        final_message = "Đã dừng" if task_manager.is_task_cancelled(task_id) else "Hoàn tất!"
        task_manager.update_task_details(task_id, {
            "overall_progress": overall_images_generated,
            "current_class_name": "",
            "message": final_message
        })

    finally:
        task_manager.complete_task(task_id)