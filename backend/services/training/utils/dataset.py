# backend/services/training/utils/dataset.py
import shutil
import random
from pathlib import Path
import yaml 
import os
import glob
from ....config import settings
from ....database import models
from collections import Counter
import json

IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

ARTIFACT_ROOT = Path(settings.BASE_DIR) / "storage"
TEST_OUTPUT_ROOT = ARTIFACT_ROOT / "testing_sessions"
TEST_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

def _is_image_file(p: Path):
    return p.is_file() and p.suffix.lower() in IMG_EXTS

def _has_any_image(p: Path):
    return any(_is_image_file(f) for f in p.iterdir() if f.is_file())

def _has_class_subdirs(p: Path):
    for d in p.iterdir():
        if d.is_dir() and _has_any_image(d):
            return True
    return False

def _list_class_dirs(p: Path):
    return [d for d in p.iterdir() if d.is_dir() and _has_any_image(d)]

def _looks_like_yolo_detection_dir(p: Path):
    images_dir = p / "images"
    labels_dir = p / "labels"
    if images_dir.is_dir() and labels_dir.is_dir():
        imgs = [f for f in images_dir.iterdir() if _is_image_file(f)]
        lbls = [f for f in labels_dir.iterdir() if f.is_file() and f.suffix.lower() == ".txt"]
        if imgs and lbls:
            return True
    
    imgs_here = [f for f in p.iterdir() if _is_image_file(f)]
    if imgs_here:
        for img in imgs_here[:20]:
            if (p / (img.stem + ".txt")).is_file():
                return True
                
    if (p.parent / 'images').is_dir() and (p.parent / 'labels').is_dir():
         return True
         
    return False

def _looks_like_classification_dir(p: Path):
    subdirs = [d for d in p.iterdir() if d.is_dir()]
    if not subdirs:
        return False
    class_like = 0
    for d in subdirs:
        imgs = [f for f in d.iterdir() if _is_image_file(f)]
        if not imgs:
            continue
        suspicious = False
        for img in imgs[:20]:
            if (d / (img.stem + ".txt")).is_file():
                suspicious = True
                break
        if not suspicious:
            class_like += 1
    return class_like > 0

def detect_data_kind(root: Path):
    train_dir = root / "train"
    val_dir = root / "val"
    test_dir = root / "test"
    yaml_files = list(root.glob('*.yaml')) + list(root.glob('*.yml'))
    if yaml_files:
        for yf in yaml_files:
            try:
                with open(yf, 'r', encoding='utf-8') as f:
                    data_cfg = yaml.safe_load(f)
                    if data_cfg and 'names' in data_cfg and ('train' in data_cfg or 'val' in data_cfg):
                        return "detection", yf 
            except Exception:
                pass 

    if train_dir.is_dir() and val_dir.is_dir():
        if _looks_like_yolo_detection_dir(train_dir) or _looks_like_yolo_detection_dir(val_dir):
            return "detection", None
        if _looks_like_classification_dir(train_dir) and _looks_like_classification_dir(val_dir):
            return "classification", None
    if test_dir.is_dir():
         if _looks_like_yolo_detection_dir(test_dir):
            return "detection", None
         if _looks_like_classification_dir(test_dir):
            return "classification", None
    if _looks_like_yolo_detection_dir(root):
        return "detection", None
    if _looks_like_classification_dir(root):
        return "classification", None

    return "unknown", None

def _clone_existing_split(src_root: Path, dst_root: Path):
    for split_name in ["train", "val", "test"]:
        s = src_root / split_name
        if not s.is_dir():
            continue
        for cls_dir in s.iterdir():
            if not cls_dir.is_dir():
                continue
            dest_cls = dst_root / split_name / cls_dir.name
            dest_cls.mkdir(parents=True, exist_ok=True)
            for f in cls_dir.iterdir():
                if f.is_file():
                    shutil.copy2(f, dest_cls / f.name)

def _auto_split_single_level(src_root: Path,
                             dst_root: Path,
                             ratio_train: float,
                             ratio_val: float,
                             ratio_test: float):
    train_dir = dst_root / "train"
    val_dir = dst_root / "val"
    test_dir = dst_root / "test"
    train_dir.mkdir(parents=True, exist_ok=True)
    val_dir.mkdir(parents=True, exist_ok=True)
    test_dir.mkdir(parents=True, exist_ok=True)
    class_dirs = _list_class_dirs(src_root)
    for cls_path in class_dirs:
        cls_name = cls_path.name
        imgs = [f for f in cls_path.iterdir() if _is_image_file(f)]
        imgs.sort()
        random.shuffle(imgs)
        n = len(imgs)
        n_train = int(n * ratio_train)
        n_val = int(n * ratio_val)
        n_test = n - n_train - n_val
        if n_test < 0:
            n_test = 0
        splits = {
            "train": imgs[:n_train],
            "val": imgs[n_train:n_train + n_val],
            "test": imgs[n_train + n_val:]
        }
        for split_name, split_imgs in splits.items():
            dst_cls_dir = dst_root / split_name / cls_name
            dst_cls_dir.mkdir(parents=True, exist_ok=True)
            for f in split_imgs:
                shutil.copy2(f, dst_cls_dir / f.name)

def _looks_like_already_split(p: Path):
    train_dir = p / "train"
    val_dir = p / "val"
    return (
        train_dir.is_dir()
        and val_dir.is_dir()
        and _has_class_subdirs(train_dir)
        and _has_class_subdirs(val_dir)
    )

def _auto_detect_detection_classes(src_root: Path) -> list:
    """
    Quét các thư mục train/labels, val/labels, ... để tìm chỉ số class cao nhất.
    Trả về ['class_0', 'class_1', ...]
    """
    print("DEBUG: No .yaml found. Running auto-detection for classes...")
    max_index = -1
    
    label_files = glob.glob(str(src_root / "**" / "labels" / "*.txt"), recursive=True)
    
    if not label_files:
        label_files = glob.glob(str(src_root / "labels" / "*.txt"))
        
    if not label_files:
         label_files = glob.glob(str(src_root / "*.txt"))

    if not label_files:
        raise ValueError("Không tìm thấy file label (.txt) nào để tự động nhận diện class.")

    print(f"DEBUG: Found {len(label_files)} label files to scan.")
    
    for f_path in label_files:
        try:
            with open(f_path, 'r') as f:
                for line in f:
                    parts = line.split()
                    if parts:
                        class_index = int(parts[0])
                        if class_index > max_index:
                            max_index = class_index
        except Exception as e:
            print(f"Warning: Could not read or parse label file {f_path}: {e}")

    if max_index == -1:
        raise ValueError("Đã tìm thấy file label, nhưng không có nội dung hoặc không đọc được chỉ số class.")

    print(f"DEBUG: Auto-detection found max_index = {max_index}")
    return [f'class_{i}' for i in range(max_index + 1)]

def _auto_split_detection_data(src_root: Path,
                               dst_root: Path,
                               ratio_train: float,
                               ratio_val: float,
                               ratio_test: float):
    print("DEBUG: Auto-splitting detection data...")
    src_images_dir = src_root / "images"
    src_labels_dir = src_root / "labels"
    
    if not src_images_dir.is_dir() or not src_labels_dir.is_dir():
        raise ValueError("Cấu trúc detection không hợp lệ. Không tìm thấy 'images' và 'labels' ở thư mục gốc.")

    imgs = [f for f in src_images_dir.iterdir() if _is_image_file(f)]
    imgs.sort()
    random.shuffle(imgs)

    n = len(imgs)
    n_train = int(n * ratio_train)
    n_val = int(n * ratio_val)
    
    splits_files = {
        "train": imgs[:n_train],
        "val": imgs[n_train:n_train + n_val],
        "test": imgs[n_train + n_val:]
    }

    split_paths = {}
    for split_name in ["train", "val", "test"]:
        (dst_root / split_name / "images").mkdir(parents=True, exist_ok=True)
        (dst_root / split_name / "labels").mkdir(parents=True, exist_ok=True)
        split_paths[split_name] = str((dst_root / split_name / "images").resolve())
    
    for split_name, split_imgs in splits_files.items():
        dst_img_dir = dst_root / split_name / "images"
        dst_lbl_dir = dst_root / split_name / "labels"
        
        for img_file in split_imgs:
            lbl_file = src_labels_dir / (img_file.stem + ".txt")
            
            if lbl_file.is_file():
                shutil.copy2(img_file, dst_img_dir / img_file.name)
                shutil.copy2(lbl_file, dst_lbl_dir / lbl_file.name)
            else:
                print(f"Warning: Missing label for {img_file.name}, skipping.")
                
    return split_paths 

def _clone_existing_detection_split(src_root: Path, dst_root: Path) -> dict:
    """
    Sao chép (hoặc symlink) cấu trúc train/val/test đã có của detection.
    Trả về đường dẫn tuyệt đối.
    """
    print("DEBUG: Cloning existing detection split...")
    split_paths = {}
    
    for split_name in ["train", "val", "test"]:
        src_split = src_root / split_name
        if src_split.is_dir() and (src_split / "images").is_dir():
            
            dst_split_dir = dst_root / split_name
            shutil.copytree(src_split, dst_split_dir, dirs_exist_ok=True)
            
            split_paths[split_name] = str((dst_split_dir / "images").resolve())
        
    if "train" not in split_paths or "val" not in split_paths:
         raise ValueError("Dataset đã chia split nhưng thiếu thư mục 'train' hoặc 'val'.")

    return split_paths
def count_det_split(split_dir: Path, num_classes: int):
    """
    split_dir: dataset_ready/train or val or test
    expects:
      images/
      labels/
    Count number of images + number of labels per class
    """
    labels_dir = split_dir / "labels"
    images_dir = split_dir / "images"

    if not labels_dir.exists() or not images_dir.exists():
        return {"total": 0, "per_class": {}}

    txts = list(labels_dir.glob("*.txt"))
    total_images = len(list(images_dir.glob("*")))

    counter = Counter()
    for p in txts:
        try:
            lines = p.read_text(encoding="utf-8").strip().splitlines()
            for ln in lines:
                if not ln.strip():
                    continue
                cls_id = int(ln.split()[0])
                counter[cls_id] += 1
        except:
            pass

    per_class = {str(i): int(counter.get(i, 0)) for i in range(num_classes)}
    return {"total": total_images, "per_class": per_class}


def build_dataset_stats(final_data_path: str, task_type: str, class_names: list):
    """
    final_data_path:
      - classification: path to dataset_ready folder
      - detection: path to data_ready.yaml
    """
    num_classes = len(class_names) if class_names else 0

    stats = {
        "num_classes": num_classes,
        "class_names": class_names or [],
        "splits": {}
    }

    if task_type == "classification":
        root = Path(final_data_path)
        for sp in ["train", "val", "test"]:
            sp_dir = root / sp
            if not sp_dir.exists():
                continue

            per_class = {}
            total = 0
            for cls_dir in _list_class_dirs(sp_dir):
                n_imgs = len([f for f in cls_dir.iterdir() if _is_image_file(f)])
                per_class[cls_dir.name] = n_imgs
                total += n_imgs

            stats["splits"][sp] = {"total": total, "per_class": per_class}

    elif task_type == "detection":
        # final_data_path is yaml, so folder is its parent
        yaml_path = Path(final_data_path)
        root = yaml_path.parent
        for sp in ["train", "val", "test"]:
            sp_dir = root / sp
            if not sp_dir.exists():
                continue
            stats["splits"][sp] = count_det_split(sp_dir, num_classes)

    return stats

def prepare_dataset(ts, train_output_root: Path):


    src_root = Path(ts.dataset_path)
    session_dir = train_output_root / f"session_{ts.id}"
    dataset_ready = session_dir / "dataset_ready"
    
    if dataset_ready.exists():
        shutil.rmtree(dataset_ready)
    dataset_ready.mkdir(parents=True, exist_ok=True)
    
    detected_task, data_yaml_path = detect_data_kind(src_root)
    
    if detected_task != "unknown" and ts.task_type != detected_task:
        print(f"Warning: User selected '{ts.task_type}' but data looks like '{detected_task}'. Overriding to '{detected_task}'.")
        ts.task_type = detected_task
    elif detected_task == "unknown":
        raise ValueError(f"Không thể nhận diện cấu trúc dataset tại: {src_root}")

    class_names = []
    final_data_path = ""

    # --- XỬ LÝ CLASSIFICATION  ---
    if detected_task == "classification":
        if (src_root / "train").is_dir() and (src_root / "val").is_dir() \
           and _has_class_subdirs(src_root / "train") \
           and _has_class_subdirs(src_root / "val"):
            _clone_existing_split(src_root, dataset_ready)
        else:
            _auto_split_single_level(
                src_root,
                dataset_ready,
                ts.split_train_ratio,
                ts.split_val_ratio,
                ts.split_test_ratio
            )
        
        train_cls_dirs = _list_class_dirs(dataset_ready / "train")
        class_names = sorted([d.name for d in train_cls_dirs])
        final_data_path = str(dataset_ready) 

    # --- XỬ LÝ DETECTION  ---
    elif detected_task == "detection":
        data_cfg = {}
        
        if data_yaml_path:
            # Case 1: Người dùng cung cấp file .yaml
            print(f"DEBUG: Found user-provided .yaml: {data_yaml_path}")
            with open(data_yaml_path, 'r', encoding='utf-8') as f:
                data_cfg = yaml.safe_load(f)
            class_names = data_cfg.get('names', [])
            if not class_names:
                raise ValueError(f"File {data_yaml_path} không chứa danh sách 'names'")
        else:
            # Case 2: KHÔNG có file .yaml -> Tự động hóa
            print("DEBUG: No .yaml found. Running auto-detection...")
            class_names = _auto_detect_detection_classes(src_root)
            data_cfg['names'] = class_names 
        
        new_cfg = {
            'nc': len(class_names),
            'names': class_names
        }
        
        if (src_root / "train").is_dir() and (src_root / "val").is_dir():
            split_paths = _clone_existing_detection_split(src_root, dataset_ready)
            new_cfg['train'] = str((dataset_ready / 'train' / 'images').resolve())
            new_cfg['val'] = str((dataset_ready / 'val' / 'images').resolve())
            if (dataset_ready / 'test' / 'images').exists():
                 new_cfg['test'] = str((dataset_ready / 'test' / 'images').resolve())
        
        elif (src_root / "images").is_dir() and (src_root / "labels").is_dir():
            split_paths = _auto_split_detection_data(
                src_root,
                dataset_ready,
                ts.split_train_ratio,
                ts.split_val_ratio,
                ts.split_test_ratio
            )
            new_cfg['train'] = split_paths.get('train')
            new_cfg['val'] = split_paths.get('val')
            new_cfg['test'] = split_paths.get('test')
        
        else:
            # Thử đọc đường dẫn từ file .yaml của người dùng (nếu có)
            if data_yaml_path:
                print("DEBUG: Using paths from user's .yaml file.")
                yaml_dir = data_yaml_path.parent
                for split in ['train', 'val', 'test']:
                    if data_cfg.get(split):
                        abs_path = (yaml_dir / data_cfg[split]).resolve()
                        new_cfg[split] = str(abs_path)
            else:
                 raise ValueError("Cấu trúc dataset detection không hợp lệ (không tìm thấy train/val hoặc images/labels).")

        # Ghi file yaml MỚI vào thư mục session
        new_data_yaml_path = dataset_ready / "data_ready.yaml"
        with open(new_data_yaml_path, 'w', encoding='utf-8') as f:
            yaml.dump(new_cfg, f, allow_unicode=True, sort_keys=False)
        
        final_data_path = str(new_data_yaml_path) 
        # ==== build dataset stats for UI ====
    try:
        dataset_stats = build_dataset_stats(final_data_path, detected_task, class_names)
        ts.dataset_stats_json = json.dumps(dataset_stats)
        ts.num_classes = dataset_stats.get("num_classes")
    except Exception as e:
        print("DEBUG build_dataset_stats failed:", e)
        ts.dataset_stats_json = None
        ts.num_classes = len(class_names) if class_names else None

    # 3. Trả về kết quả
    return final_data_path, detected_task, class_names

def prepare_test_data(ts: models.TestingSession, test_output_root: Path) -> tuple[str, str, list]:
    print(f"DEBUG: Preparing test data for session {ts.id} at {ts.dataset_path}")
    src_root = Path(ts.dataset_path)
    
    # Tạo thư mục tạm để chứa .yaml
    test_ready_dir = test_output_root / f"session_{ts.id}_test_ready"
    if test_ready_dir.exists():
        shutil.rmtree(test_ready_dir)
    test_ready_dir.mkdir(parents=True, exist_ok=True)

    # 1. Nhận diện task
    detected_task, data_yaml_path = detect_data_kind(src_root)
    if detected_task == "unknown":
        raise ValueError(f"Không thể nhận diện cấu trúc dataset test tại: {src_root}")

    class_names = []
    final_data_path = ""

    # 2. Xử lý Classification
    if detected_task == "classification":
        if not _looks_like_classification_dir(src_root):
             raise ValueError("Dataset test classification phải có cấu trúc thư mục con là tên class.")
        
        # Lấy class names từ thư mục
        class_names = sorted([d.name for d in _list_class_dirs(src_root)])
        final_data_path = str(src_root)
        
    # 3. Xử lý Detection
    elif detected_task == "detection":
        if data_yaml_path:
            # Case 1: Người dùng cung cấp file .yaml
            print(f"DEBUG: Found user-provided .yaml: {data_yaml_path}")
            with open(data_yaml_path, 'r', encoding='utf-8') as f:
                data_cfg = yaml.safe_load(f)
            class_names = data_cfg.get('names', [])
            final_data_path = str(data_yaml_path) # Dùng thẳng file .yaml của user
        
        else:
            # Case 2: Auto-detect 
            print("DEBUG: No .yaml found. Running auto-detection for test data...")
            class_names = _auto_detect_detection_classes(src_root)
            
            # Kiểm tra xem images/ ở đâu
            images_dir = src_root / "images"
            if not images_dir.is_dir():
                # Nếu không có images/ ở gốc, có thể data là thư mục gốc
                if not any(_is_image_file(f) for f in src_root.iterdir()):
                     raise ValueError("Không tìm thấy thư mục 'images' trong dataset test detection.")
                images_dir = src_root 

            # Tạo file test_data.yaml
            new_yaml_path = test_ready_dir / "test_data.yaml"
            images_path_str = str(images_dir.resolve())
            new_cfg = {
                'train': images_path_str,
                'val': images_path_str,
                'test': images_path_str,
                'nc': len(class_names),
                'names': class_names
            }
            
            with open(new_yaml_path, 'w', encoding='utf-8') as f:
                yaml.dump(new_cfg, f, allow_unicode=True, sort_keys=False)
            
            final_data_path = str(new_yaml_path)

    return final_data_path, detected_task, class_names