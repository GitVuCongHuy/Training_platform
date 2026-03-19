from pathlib import Path
from typing import Optional, Literal, Dict, Any
from ultralytics import YOLO

SUPPORTED_FORMATS = ["onnx", "tensorrt"]
_FMT_MAP = {"onnx": "onnx", "tensorrt": "engine"}

def export_yolo_pt(
    pt_path: Path,
    outdir: Path,
    fmt: Literal["onnx","tensorrt"] = "onnx",
    opts: Optional[Dict[str, Any]] = None
) -> Path:
    opts = opts or {}
    outdir.mkdir(parents=True, exist_ok=True)
    if pt_path.suffix.lower() != ".pt":
        raise TypeError("export_yolo_pt chỉ nhận .pt")

    model = YOLO(str(pt_path))
    args: Dict[str, Any] = {"format": _FMT_MAP[fmt]}

    if "imgsz" in opts and opts["imgsz"] is not None:
        args["imgsz"] = int(opts["imgsz"]) if isinstance(opts["imgsz"], int) else tuple(opts["imgsz"])

    if fmt == "onnx":   
        if "opset" in opts:    args["opset"] = int(opts["opset"])
        if "dynamic" in opts:  args["dynamic"] = bool(opts["dynamic"])
        if "simplify" in opts: args["simplify"] = bool(opts["simplify"])

    if fmt == "tensorrt":  
        if opts.get("fp16", True):     args["half"] = True
        if opts.get("dynamic", True):  args["dynamic"] = True
        if "workspace" in opts:        args["workspace"] = int(opts["workspace"])  # GB
        if "device" in opts:           args["device"] = int(opts["device"])

    out_path = model.export(**args)
    if not out_path:
        raise RuntimeError("Ultralytics export trả về None (có thể thiếu TensorRT Python API).")
    return Path(out_path)


def onnx_to_tensorrt(onnx_path: Path, outdir: Path, opts: Optional[Dict[str, Any]] = None) -> Path:
    """
    Build TensorRT engine từ ONNX qua Python API.
    Yêu cầu: `pip install tensorrt` (trên Python 3.10/3.11) và driver phù hợp.
    """
    opts = opts or {}
    outdir.mkdir(parents=True, exist_ok=True)
    if onnx_path.suffix.lower() != ".onnx":
        raise TypeError("onnx_to_tensorrt chỉ nhận .onnx")

    try:
        import tensorrt as trt
    except Exception as e:
        raise RuntimeError("Chưa cài tensorrt cho Python hiện tại.") from e

    logger = trt.Logger(trt.Logger.WARNING)
    builder = trt.Builder(logger)
    flag = 1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH)
    network = builder.create_network(flag)
    parser = trt.OnnxParser(network, logger)

    with open(onnx_path, "rb") as f:
        if not parser.parse(f.read()):
            err = "\n".join([parser.get_error(i).desc() for i in range(parser.num_errors)])
            raise RuntimeError(f"ONNX parse failed:\n{err}")

    config = builder.create_builder_config()
    ws_gb = int(opts.get("workspace", 2))
    config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, ws_gb * (1 << 30))

    if opts.get("fp16", True) and builder.platform_has_fast_fp16:
        config.set_flag(trt.BuilderFlag.FP16)

    profile = builder.create_optimization_profile()
    for i in range(network.num_inputs):
        inp = network.get_input(i)
        shape = inp.shape
        if -1 in shape:
            imgsz = int(opts.get("imgsz", 640))
            c = shape[1] if len(shape) > 1 and shape[1] != -1 else 3
            min_shape = (1, c, imgsz, imgsz)
            opt_shape = (1, c, imgsz, imgsz)
            max_b = max(4, int(opts.get("max_batch", 4)))
            max_shape = (max_b, c, imgsz, imgsz)
            profile.set_shape(inp.name, min_shape, opt_shape, max_shape)
    config.add_optimization_profile(profile)

    engine_path = outdir / (onnx_path.stem + ".engine")
    with builder.build_serialized_network(network, config) as plan:
        if plan is None:
            raise RuntimeError("TensorRT build failed (plan=None).")
        engine_path.write_bytes(bytes(plan))

    return engine_path
