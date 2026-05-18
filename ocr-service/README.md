# OCR Sidecar

A small Python FastAPI service the Next.js app calls to extract text + layout from invoice PDFs.

Two engines, auto-selected at startup:

| Engine | When | How accurate | Setup difficulty |
|---|---|---|---|
| **PaddleOCR (PP-StructureV3)** | Python 3.8–3.12, paddlepaddle installable | Highest — production target | Hard on Windows |
| **Tesseract** | Fallback if PaddleOCR isn't installed | Lower, but works | Easy |

The Next.js side talks to whichever is active via `POST /extract { "pdf_path": "<abs path>" }`.

---

## Setup (Windows)

1. Install Tesseract binary: <https://github.com/UB-Mannheim/tesseract/wiki>. Default install location works; `pytesseract` finds it via `PATH`.
2. Create a venv and install Python deps:

```powershell
cd ocr-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

3. Run the service:

```powershell
python app.py
# or:
uvicorn app:app --host 127.0.0.1 --port 8001 --reload
```

Visit <http://127.0.0.1:8001/health> — should return `{ "ok": true, "engine": "tesseract" }`.

---

## Upgrading to PaddleOCR

PaddleOCR is the production target, but its `paddlepaddle` wheel only supports Python 3.8–3.12. If your Python is in range:

```powershell
pip install paddleocr paddlepaddle
```

Restart the service. `/health` will then report `engine: "paddleocr"`.

---

## API

### `GET /health`

```json
{ "ok": true, "engine": "tesseract" }
```

### `POST /extract`

Request:
```json
{ "pdf_path": "C:\\path\\to\\invoice.pdf" }
```

Response:
```json
{
  "engine": "tesseract",
  "blocks": [
    { "text": "Invoice No.", "bbox": [120, 80, 240, 100], "confidence": 0.94 },
    { "text": "TS-2026-0142", "bbox": [260, 80, 410, 100], "confidence": 0.91 }
  ],
  "overall_confidence": 0.88,
  "duration_ms": 1840
}
```

Errors: `400` invalid path, `404` PDF not found, `503` no engine available, `500` extraction failed.
