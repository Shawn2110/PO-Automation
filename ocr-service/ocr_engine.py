"""OCR engine abstraction.

Two implementations: PaddleOCR (preferred, production target) and Tesseract (fallback).
The Next.js sidecar calls `extract(pdf_path)` and gets back a list of Block dicts that
match the TypeScript Block type in web/lib/extraction/types.ts.

Block dict shape: { "text": str, "bbox": [x1, y1, x2, y2], "confidence": float }
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from typing import List, Tuple, Optional

import fitz  # PyMuPDF


@dataclass
class Block:
    text: str
    bbox: Tuple[float, float, float, float]
    confidence: float

    def to_dict(self):
        return {"text": self.text, "bbox": list(self.bbox), "confidence": self.confidence}


# ──────────────────────────────────────────────────────────────
#  Engine discovery — try to import each at module load time.
# ──────────────────────────────────────────────────────────────
_paddle = None
_tesseract = None
_pil = None
_active_engine: Optional[str] = None

try:
    from paddleocr import PaddleOCR  # type: ignore
    _paddle = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    _active_engine = "paddleocr"
except Exception:
    _paddle = None

if _paddle is None:
    try:
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore
        _tesseract = pytesseract
        _pil = Image
        _active_engine = "tesseract"
    except Exception:
        _tesseract = None

if _active_engine is None:
    # Defer raising until a request actually arrives — the service should still boot
    # so callers see a clean 503 with an actionable error message.
    pass


def active_engine() -> Optional[str]:
    return _active_engine


# ──────────────────────────────────────────────────────────────
#  PDF rasterization — first page only for the demo.
# ──────────────────────────────────────────────────────────────
def _rasterize_first_page(pdf_path: str, dpi: int = 150):
    doc = fitz.open(pdf_path)
    try:
        if doc.page_count == 0:
            raise ValueError("PDF has no pages")
        page = doc.load_page(0)
        zoom = dpi / 72
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        return pix.tobytes("png"), pix.width, pix.height
    finally:
        doc.close()


# ──────────────────────────────────────────────────────────────
#  Engine adapters
# ──────────────────────────────────────────────────────────────
def _extract_paddle(png_bytes: bytes) -> List[Block]:
    import numpy as np
    import cv2

    arr = np.frombuffer(png_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    result = _paddle.ocr(img, cls=True)
    if not result or not result[0]:
        return []

    blocks: List[Block] = []
    for line in result[0]:
        coords, (text, confidence) = line
        xs = [p[0] for p in coords]
        ys = [p[1] for p in coords]
        bbox = (min(xs), min(ys), max(xs), max(ys))
        blocks.append(Block(text=str(text), bbox=bbox, confidence=float(confidence)))
    return blocks


def _extract_tesseract(png_bytes: bytes) -> List[Block]:
    img = _pil.open(io.BytesIO(png_bytes))
    data = _tesseract.image_to_data(img, output_type=_tesseract.Output.DICT)
    blocks: List[Block] = []
    n = len(data["text"])
    # Group words by (block_num, par_num, line_num) so we get phrase-level blocks
    # instead of one-block-per-word. That's closer to what PaddleOCR returns
    # and what the template matcher in web/ expects.
    line_buckets = {}
    for i in range(n):
        text = (data["text"][i] or "").strip()
        if not text:
            continue
        conf_raw = data["conf"][i]
        try:
            conf = float(conf_raw) / 100.0
        except (TypeError, ValueError):
            conf = 0.0
        if conf <= 0:
            continue
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        x = data["left"][i]
        y = data["top"][i]
        w = data["width"][i]
        h = data["height"][i]
        bucket = line_buckets.setdefault(key, {"words": [], "x1": x, "y1": y, "x2": x + w, "y2": y + h, "confs": []})
        bucket["words"].append(text)
        bucket["x1"] = min(bucket["x1"], x)
        bucket["y1"] = min(bucket["y1"], y)
        bucket["x2"] = max(bucket["x2"], x + w)
        bucket["y2"] = max(bucket["y2"], y + h)
        bucket["confs"].append(conf)

    for bucket in line_buckets.values():
        text = " ".join(bucket["words"])
        conf = sum(bucket["confs"]) / len(bucket["confs"])
        blocks.append(Block(
            text=text,
            bbox=(bucket["x1"], bucket["y1"], bucket["x2"], bucket["y2"]),
            confidence=conf,
        ))
    return blocks


# ──────────────────────────────────────────────────────────────
#  Public API
# ──────────────────────────────────────────────────────────────
def extract(pdf_path: str) -> dict:
    if _active_engine is None:
        raise RuntimeError(
            "No OCR engine available. Install pytesseract + Tesseract binary, "
            "or PaddleOCR (Python 3.8–3.12). See ocr-service/README.md."
        )

    png_bytes, _, _ = _rasterize_first_page(pdf_path)

    if _active_engine == "paddleocr":
        blocks = _extract_paddle(png_bytes)
    else:
        blocks = _extract_tesseract(png_bytes)

    overall_conf = (
        sum(b.confidence for b in blocks) / len(blocks) if blocks else 0.0
    )

    return {
        "engine": _active_engine,
        "blocks": [b.to_dict() for b in blocks],
        "overall_confidence": overall_conf,
    }
