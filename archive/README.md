# Archive

Code kept for reference but no longer in the deploy path.

## `ocr-service/`

Phase 1 OCR sidecar — PaddleOCR (preferred) / Tesseract (fallback) via FastAPI.
Replaced by `../modal-vlm/` (Qwen2.5-VL-7B-AWQ on Modal) in May 2026.

The Next.js app no longer calls this; `web/lib/ocr.ts` now hits the Modal
endpoint instead. The Python code here still runs standalone if you want to
benchmark Tesseract vs Qwen on the same PDFs — see `ocr-service/README.md` for
the local-run instructions.

The downstream template-matching utilities in `web/lib/extraction/` are also
unreferenced now but kept in place; `parse.ts` still has useful date/amount
parsers we may reuse to normalize VLM output.
