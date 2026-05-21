"""FastAPI OCR sidecar. Started independently of the Next.js app.

Run:
    uvicorn app:app --host 127.0.0.1 --port 8001 --reload

The Next.js app calls POST /extract with { "pdf_path": "<absolute path>" } and
gets back a JSON list of OCR blocks. See web/lib/ocr.ts.
"""
from __future__ import annotations

import os
import time
import traceback
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import ocr_engine

app = FastAPI(title="PO Automation OCR Sidecar", version="0.1.0")


class ExtractRequest(BaseModel):
    pdf_path: str


@app.get("/health")
def health():
    """Reports which engine is wired up and whether its binary is reachable."""
    engine = ocr_engine.active_engine()
    info = {"ok": True, "engine": engine}

    if engine == "tesseract":
        try:
            import pytesseract
            info["tesseract_cmd"] = pytesseract.pytesseract.tesseract_cmd
            info["tesseract_version"] = str(pytesseract.get_tesseract_version())
        except Exception as e:
            info["ok"] = False
            info["error"] = f"Tesseract binary not reachable: {e}. " \
                            "Install from https://github.com/UB-Mannheim/tesseract/wiki " \
                            "or set tesseract_cmd in ocr_engine.py."

    return info


@app.post("/extract")
def extract(req: ExtractRequest):
    path = Path(req.pdf_path)
    if not path.is_absolute():
        raise HTTPException(status_code=400, detail="pdf_path must be absolute")
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"PDF not found at {path}")
    if path.suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="File is not a PDF")

    start = time.monotonic()
    try:
        result = ocr_engine.extract(str(path))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        # Surface the real error to the caller so the Next.js UI can show it.
        tb = traceback.format_exc()
        print(f"[extract] FAILED for {path}:\n{tb}", flush=True)
        raise HTTPException(
            status_code=500,
            detail=f"{type(e).__name__}: {e}",
        )

    result["duration_ms"] = int((time.monotonic() - start) * 1000)
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=int(os.environ.get("PORT", 8001)), reload=False)
