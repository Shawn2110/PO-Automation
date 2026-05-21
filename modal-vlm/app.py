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
        "transformers>=4.49.0",
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
    enable_memory_snapshot=True,
)
class InvoiceVLM:
    @modal.enter()
    def load(self):
        import os
        os.environ["HF_HOME"] = "/cache/huggingface"
        os.environ["TRANSFORMERS_CACHE"] = "/cache/huggingface"

        from vllm import LLM, SamplingParams
        from vllm.sampling_params import GuidedDecodingParams

        # Schema-guided decoding pins the model output to valid JSON we can parse.
        # Numbers are typed as ["number", "null"] so the model can decline cleanly.
        self._schema = {
            "type": "object",
            "properties": {
                "invoiceNumber":   {"type": ["string", "null"]},
                "invoiceDate":     {"type": ["string", "null"]},  # ISO 8601 YYYY-MM-DD
                "vendorName":      {"type": ["string", "null"]},
                "gstNumber":       {"type": ["string", "null"]},  # 15-char Indian GSTIN
                "amountBeforeGst": {"type": ["number", "null"]},
                "amountAfterGst":  {"type": ["number", "null"]},
            },
            "required": [
                "invoiceNumber", "invoiceDate", "vendorName",
                "gstNumber", "amountBeforeGst", "amountAfterGst",
            ],
            "additionalProperties": False,
        }

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
            guided_decoding=GuidedDecodingParams(json=self._schema),
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

    def _build_messages(self, image):
        return [
            {
                "role": "system",
                "content": (
                    "You are an invoice extraction system for Indian GST tax invoices. "
                    "Look at the invoice image and return exactly these six fields as JSON: "
                    "invoiceNumber (the invoice/document number as printed), "
                    "invoiceDate (ISO 8601 date YYYY-MM-DD), "
                    "vendorName (the seller/supplier name, NOT the buyer), "
                    "gstNumber (the 15-character GSTIN of the seller), "
                    "amountBeforeGst (taxable value as a number, no currency symbols or commas), "
                    "amountAfterGst (final grand total including tax as a number). "
                    "If a field is genuinely not present, return null for that field. "
                    "Do not invent values. Do not include any text outside the JSON."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": "Extract the six fields as JSON."},
                ],
            },
        ]

    def _run_vlm(self, pdf_bytes: bytes) -> dict:
        """Internal: run rasterize + VLM, return parsed dict."""
        import json
        import time

        start = time.monotonic()
        image = self._rasterize_page1(pdf_bytes)
        messages = self._build_messages(image)

        outputs = self.llm.chat(messages, sampling_params=self._sampling)
        text = outputs[0].outputs[0].text.strip()

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            # Guided decoding should make this unreachable, but be defensive.
            raise RuntimeError(f"VLM output was not valid JSON: {text[:400]}")

        # Compute derived gstPct + field-completeness confidence.
        before = parsed.get("amountBeforeGst")
        after = parsed.get("amountAfterGst")
        gst_pct = None
        if isinstance(before, (int, float)) and isinstance(after, (int, float)) and before > 0:
            gst_pct = round(((after - before) / before) * 100, 2)

        non_null = sum(1 for k in (
            "invoiceNumber", "invoiceDate", "vendorName",
            "gstNumber", "amountBeforeGst", "amountAfterGst",
        ) if parsed.get(k) not in (None, ""))
        confidence = round(non_null / 6, 3)

        return {
            **parsed,
            "gstPct": gst_pct,
            "confidence": confidence,
            "engine": "qwen2.5-vl-7b-awq",
            "durationMs": int((time.monotonic() - start) * 1000),
        }

    @modal.fastapi_endpoint(method="POST", docs=False)
    def extract(self, file: bytes = None, authorization: str = None):
        # NOTE: this signature is a placeholder — Modal injects a FastAPI request,
        # but `@modal.fastapi_endpoint` doesn't natively support multipart well.
        # The real handler lives in the asgi_app below; this stub is here so the
        # class also exposes a callable RPC for tests via .extract.remote(bytes).
        raise RuntimeError("Use /extract on the asgi_app web endpoint, not this stub.")

    @modal.method()
    def extract_rpc(self, pdf_bytes: bytes) -> dict:
        """RPC entrypoint — also used by the asgi_app handler."""
        return self._run_vlm(pdf_bytes)


@app.function(
    image=modal.Image.debian_slim(python_version="3.11").pip_install(
        "fastapi[standard]", "python-multipart"
    ),
    secrets=[modal.Secret.from_name("po-automation-secrets")],
    timeout=600,
)
@modal.asgi_app()
def web():
    """Public HTTP endpoint. Validates the bearer token, then dispatches to the
    GPU class which runs the actual VLM extraction."""
    import os
    from fastapi import FastAPI, File, UploadFile, Header, HTTPException

    api = FastAPI(title="PO Automation VLM", docs_url=None, redoc_url=None)
    expected = os.environ["MODAL_AUTH_TOKEN"]

    @api.get("/health")
    def health():
        return {"ok": True, "engine": "qwen2.5-vl-7b-awq", "model": MODEL_NAME}

    @api.post("/extract")
    async def extract(
        pdf: UploadFile = File(...),
        authorization: str | None = Header(default=None),
    ):
        if not authorization or authorization != f"Bearer {expected}":
            raise HTTPException(status_code=401, detail="Unauthorized")
        if pdf.content_type not in ("application/pdf", "application/octet-stream"):
            raise HTTPException(status_code=400, detail="Only PDF files accepted")

        pdf_bytes = await pdf.read()
        if len(pdf_bytes) < 4 or pdf_bytes[:4] != b"%PDF":
            raise HTTPException(status_code=400, detail="Not a valid PDF (missing %PDF magic)")
        if len(pdf_bytes) > 20 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="PDF exceeds 20MB")

        try:
            result = InvoiceVLM().extract_rpc.remote(pdf_bytes)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
        return result

    return api
