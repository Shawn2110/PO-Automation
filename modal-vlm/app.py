"""Modal sidecar — Qwen2.5-VL-7B-AWQ for invoice extraction.

Takes a PDF over multipart, returns the six canonical invoice fields as JSON.
Replaces the Tesseract OCR + template-matching pipeline from ../archive/ocr-service/.

Deploy:
    modal token new                  # one-time
    modal deploy app.py

The deploy command prints the endpoint URL — paste into the Next.js app's
MODAL_VLM_URL env var. Bearer token comes from the Modal secret
'po-automation-secrets' (create it once with:
    modal secret create po-automation-secrets MODAL_AUTH_TOKEN=<random-32-chars>).
"""
from __future__ import annotations

import modal

app = modal.App("po-automation-vlm")

MODEL_NAME = "Qwen/Qwen2.5-VL-7B-Instruct-AWQ"
MODEL_REVISION = "main"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "vllm==0.7.3",
        # vLLM 0.7.3 uses Qwen2Tokenizer.all_special_tokens_extended which transformers 5.x
        # removed. Pin to the 4.x line until we bump vLLM.
        "transformers==4.49.0",
        "pillow>=10.3.0",
        "pymupdf>=1.24.0",
        "fastapi[standard]",
        "python-multipart",
        "huggingface_hub[hf_transfer]",
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

# Persistent volume for HF weights — saves ~14GB re-download on every cold container.
cache_vol = modal.Volume.from_name("po-automation-vlm-cache", create_if_missing=True)


@app.cls(
    gpu="L4",
    image=image,
    volumes={"/cache": cache_vol},
    secrets=[modal.Secret.from_name("po-automation-secrets")],
    timeout=600,
    scaledown_window=300,
    # Memory snapshot temporarily disabled — Modal caches old function definitions
    # in the snapshot which makes code changes invisible until the snapshot is
    # invalidated. Re-enable once the contract is stable.
    enable_memory_snapshot=False,
)
class InvoiceVLM:
    @modal.enter()
    def load(self):
        import os
        os.environ["HF_HOME"] = "/cache/huggingface"
        os.environ["TRANSFORMERS_CACHE"] = "/cache/huggingface"

        from vllm import LLM, SamplingParams

        # xgrammar 0.1.11 + vLLM 0.7.3 throw a C++ Variant type-mismatch on any
        # schema we tried (including pure-string fields). The prompt is strict
        # enough — we parse defensively in _run_vlm. Drop guided decoding.
        self.llm = LLM(
            model=MODEL_NAME,
            revision=MODEL_REVISION,
            quantization="awq_marlin",
            dtype="float16",
            max_model_len=8192,
            gpu_memory_utilization=0.90,
            enforce_eager=False,
            trust_remote_code=True,
        )

        self._sampling = SamplingParams(
            temperature=0.0,
            max_tokens=512,
        )

        cache_vol.commit()

    def _rasterize_page1(self, pdf_bytes: bytes):
        """Rasterize page 1 of the PDF at 144 DPI as a PIL image."""
        import io
        import fitz  # PyMuPDF
        from PIL import Image

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            if doc.page_count == 0:
                raise ValueError("PDF has no pages")
            page = doc.load_page(0)
            mat = fitz.Matrix(2.0, 2.0)  # 144 DPI ≈ 2x default
            pix = page.get_pixmap(matrix=mat, alpha=False)
            return Image.open(io.BytesIO(pix.tobytes("png")))
        finally:
            doc.close()

    SYSTEM_PROMPT = (
        "You are an invoice extraction system for Indian GST tax invoices. "
        "Look at the invoice image and return exactly these six fields as JSON. "
        "Every field is a string. If a field is genuinely not present, return "
        "an empty string '' for it. Do not invent values. Do not include any "
        "text outside the JSON. Fields:\n"
        "- invoiceNumber: the invoice/document number exactly as printed.\n"
        "- invoiceDate: the invoice date in ISO 8601 YYYY-MM-DD form.\n"
        "- vendorName: the seller/supplier name (NOT the buyer).\n"
        "- gstNumber: the 15-character GSTIN of the seller.\n"
        "- amountBeforeGst: the taxable value as a plain numeric string "
        "(no currency symbols, no commas, e.g. '245000.00').\n"
        "- amountAfterGst: the final grand total including tax as a plain "
        "numeric string."
    )

    def _run_vlm(self, pdf_bytes: bytes) -> dict:
        """Internal: run rasterize + VLM, return parsed dict."""
        import json
        import time

        start = time.monotonic()
        pil_image = self._rasterize_page1(pdf_bytes)

        # Use Qwen2.5-VL's chat-template tokens with multi_modal_data instead of
        # the OpenAI-style {"type": "image_url"} content shape — vLLM 0.7.3's chat()
        # rejects unknown part types and the Qwen image-token placeholder is the
        # documented multi-modal path.
        prompt = (
            f"<|im_start|>system\n{self.SYSTEM_PROMPT}<|im_end|>\n"
            "<|im_start|>user\n<|vision_start|><|image_pad|><|vision_end|>"
            "Extract the six fields as JSON.<|im_end|>\n"
            "<|im_start|>assistant\n"
        )

        outputs = self.llm.generate(
            {"prompt": prompt, "multi_modal_data": {"image": pil_image}},
            sampling_params=self._sampling,
        )
        text = outputs[0].outputs[0].text.strip()

        # Strip code-fence wrappers and find the first {...} block — the model
        # occasionally adds explanatory prose around the JSON.
        cleaned = text
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:]
        first_brace = cleaned.find("{")
        last_brace = cleaned.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            cleaned = cleaned[first_brace : last_brace + 1]

        try:
            raw = json.loads(cleaned)
        except json.JSONDecodeError:
            raise RuntimeError(f"VLM output was not valid JSON: {text[:400]}")

        # Schema is all-strings (xgrammar constraint). Coerce empty strings to None
        # and parse numeric strings to floats so the web side gets a clean shape.
        def _str_or_none(v):
            if not isinstance(v, str) or v.strip() == "":
                return None
            return v.strip()

        def _num_or_none(v):
            if not isinstance(v, str) or v.strip() == "":
                return None
            s = v.replace(",", "").replace("₹", "").replace("INR", "").strip()
            try:
                return float(s)
            except ValueError:
                return None

        parsed = {
            "invoiceNumber":   _str_or_none(raw.get("invoiceNumber")),
            "invoiceDate":     _str_or_none(raw.get("invoiceDate")),
            "vendorName":      _str_or_none(raw.get("vendorName")),
            "gstNumber":       _str_or_none(raw.get("gstNumber")),
            "amountBeforeGst": _num_or_none(raw.get("amountBeforeGst")),
            "amountAfterGst":  _num_or_none(raw.get("amountAfterGst")),
        }

        before = parsed["amountBeforeGst"]
        after = parsed["amountAfterGst"]
        gst_pct = None
        if before is not None and after is not None and before > 0:
            gst_pct = round(((after - before) / before) * 100, 2)

        non_null = sum(1 for v in parsed.values() if v is not None)
        confidence = round(non_null / 6, 3)

        return {
            **parsed,
            "gstPct": gst_pct,
            "confidence": confidence,
            "engine": "qwen2.5-vl-7b-awq",
            "durationMs": int((time.monotonic() - start) * 1000),
        }

    @modal.method()
    def extract_rpc(self, pdf_bytes: bytes) -> dict:
        """RPC entrypoint — called from the asgi_app web handler."""
        return self._run_vlm(pdf_bytes)


@app.function(
    image=modal.Image.debian_slim(python_version="3.11").pip_install(
        "starlette", "python-multipart"
    ),
    secrets=[modal.Secret.from_name("po-automation-secrets")],
    timeout=600,
)
@modal.asgi_app()
def web():
    """Public HTTP endpoint. Plain Starlette — we avoid FastAPI/Pydantic because
    FastAPI 0.136 + Pydantic 2.13 have a ForwardRef introspection bug that 500s
    on any annotated parameter inside a nested-scope function (which is exactly
    what @modal.asgi_app forces). Starlette doesn't introspect signatures."""
    import os
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route

    expected = os.environ["MODAL_AUTH_TOKEN"]

    async def health(request):
        return JSONResponse({"ok": True, "engine": "qwen2.5-vl-7b-awq", "model": MODEL_NAME})

    async def extract(req):
        auth = req.headers.get("authorization")
        if not auth or auth != f"Bearer {expected}":
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)

        try:
            form = await req.form()
        except Exception as e:
            return JSONResponse({"detail": f"Could not parse multipart body: {e}"}, status_code=400)

        pdf_part = form.get("pdf")
        if pdf_part is None or not hasattr(pdf_part, "read"):
            return JSONResponse({"detail": "Missing 'pdf' file part"}, status_code=400)

        content_type = getattr(pdf_part, "content_type", None)
        if content_type not in ("application/pdf", "application/octet-stream", None):
            return JSONResponse({"detail": "Only PDF files accepted"}, status_code=400)

        pdf_bytes = await pdf_part.read()
        if len(pdf_bytes) < 4 or pdf_bytes[:4] != b"%PDF":
            return JSONResponse({"detail": "Not a valid PDF (missing %PDF magic)"}, status_code=400)
        if len(pdf_bytes) > 20 * 1024 * 1024:
            return JSONResponse({"detail": "PDF exceeds 20MB"}, status_code=413)

        try:
            result = InvoiceVLM().extract_rpc.remote(pdf_bytes)
        except Exception as e:
            return JSONResponse({"detail": f"{type(e).__name__}: {e}"}, status_code=500)
        return JSONResponse(result)

    return Starlette(routes=[
        Route("/health", health, methods=["GET"]),
        Route("/extract", extract, methods=["POST"]),
    ])
