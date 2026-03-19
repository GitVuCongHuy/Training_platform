# backend/api/export_api.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Literal, Dict, Any
from pathlib import Path
import uuid, json

from ..config import settings
from ..services.export.export_service import export_yolo_pt, SUPPORTED_FORMATS

router = APIRouter(tags=["Export"])

ART_ROOT = Path(settings.BASE_DIR) / "storage" / "manual_exports"
ART_ROOT.mkdir(parents=True, exist_ok=True)

FORMAT_OPTIONS_SCHEMA = {
    "onnx": {
        "imgsz":   {"type": "int",  "label": "imgsz", "default": 640, "help": "H=W; nên khớp size train"},
        "opset":   {"type": "int",  "label": "opset", "default": 12,  "help": "ONNX opset (11–13 phổ biến)"},
        "dynamic": {"type": "bool", "label": "Dynamic axes", "default": True},
        "simplify":{"type": "bool", "label": "Simplify graph", "default": True}
    },
    "tensorrt": {
        "fp16":    {"type": "bool", "label": "FP16", "default": True},
        "int8":    {"type": "bool", "label": "INT8 (yêu cầu calib)", "default": False},
        "imgsz":   {"type": "int",  "label": "imgsz", "default": 640, "help": "Dùng khi convert từ ONNX"},
        "max_batch":{"type": "int", "label": "Max batch", "default": 1}
    }
}

@router.get("/formats")
def list_formats():
    return {"formats": ["onnx", "tensorrt"], "options_schema": FORMAT_OPTIONS_SCHEMA}


@router.post("/by-upload")
def export_by_upload(
    file: UploadFile = File(...),
    format: Literal["onnx","tensorrt"] = Form("onnx"),
    options_json: Optional[str] = Form(None)
):
    jobdir = ART_ROOT / f"job_{uuid.uuid4().hex}"
    jobdir.mkdir(parents=True, exist_ok=True)

    filename = (file.filename or "model.pt")
    dst = jobdir / filename
    with open(dst, "wb") as f:
        f.write(file.file.read())

    opts: Dict[str, Any] = {}
    if options_json:
        try:
            opts = json.loads(options_json)
        except:
            pass

    suffix = dst.suffix.lower()
    if suffix == ".pt":
        from ..services.export.export_service import export_yolo_pt
        try:
            out_file = export_yolo_pt(pt_path=dst, outdir=jobdir, fmt=format, opts=opts)
            return {"ok": True, "artifact": str(out_file)}
        except RuntimeError as e:
            raise HTTPException(status_code=400, detail=str(e))

    if suffix == ".onnx":
        if format == "onnx":
            return {"ok": True, "artifact": str(dst)}
        elif format == "tensorrt":
            from ..services.export.export_service import onnx_to_tensorrt
            try:
                out_file = onnx_to_tensorrt(onnx_path=dst, outdir=jobdir, opts=opts)
                return {"ok": True, "artifact": str(out_file)}
            except RuntimeError as e:
                raise HTTPException(status_code=400, detail=str(e))

    raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file .pt hoặc .onnx.")


@router.get("/download")
def download_artifact(path: str):
    p = Path(path).resolve()
    if not p.is_file():
        raise HTTPException(status_code=404, detail="artifact not found")

    root = ART_ROOT.resolve()
    try:
        p.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=403, detail="forbidden")

    return FileResponse(str(p), filename=p.name)
