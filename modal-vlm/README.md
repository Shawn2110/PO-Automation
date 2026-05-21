# Modal VLM sidecar — Qwen2.5-VL-7B-AWQ

GPU-hosted invoice extraction. Takes a PDF, returns six structured fields.
Replaces the Tesseract OCR + template-matching sidecar in `../archive/ocr-service/`.

## One-time setup

1. Install the Modal CLI:
   ```
   pip install modal
   ```
2. Authenticate (opens a browser tab):
   ```
   modal token new
   ```
3. Create the shared secret (used by Modal **and** Render):
   ```
   modal secret create po-automation-secrets MODAL_AUTH_TOKEN=<random-32-char-hex>
   ```
   Generate the token with `python -c "import secrets; print(secrets.token_hex(32))"`
   (or any URL-safe random). Save the value — you'll paste the same one into
   Render's `MODAL_AUTH_TOKEN` env var.

## Run

Hot-reload during dev (gives a temporary URL each time, weights cached on the
Modal Volume):
```
modal serve app.py
```

Deploy to a stable URL:
```
modal deploy app.py
```

Either command prints a URL like:
```
https://<your-username>--po-automation-vlm-web.modal.run
```

That's `MODAL_VLM_URL` — paste into `web/.env` for local dev and into Render's
service environment for prod. The Next.js app calls `<URL>/extract`.

## Endpoint

```
POST /extract
Headers: Authorization: Bearer <MODAL_AUTH_TOKEN>
Body:    multipart/form-data, pdf=<file>
Response: {
  invoiceNumber, invoiceDate, vendorName, gstNumber,
  amountBeforeGst, amountAfterGst, gstPct,
  confidence,        // field-completeness 0..1
  engine,            // "qwen2.5-vl-7b-awq"
  durationMs
}
```

`GET /health` returns `{ ok: true, engine, model }` — no auth required.

## Cold starts

First request after a quiet period takes 20–40s while the L4 spins up and the
weights load from the Modal Volume (after the first deploy populates the
volume; the very first deploy takes ~5 min to pull 14GB from HuggingFace).
Subsequent requests on a warm container take ~5–10s per invoice.

`enable_memory_snapshot=True` in `app.py` cuts cold start ~5x vs vanilla
container start. Don't disable it.

## Cost (Modal free tier)

L4 effective rate ≈ $0.80/hr. Each invoice is ~10s of compute → **~$0.002**.
The $30/month renewable credit covers ~15,000 invoices, so the demo's 50–200/mo
is trivial.

## Local sanity test

```
curl -X POST https://<modal-url>/extract \
  -H "Authorization: Bearer $MODAL_AUTH_TOKEN" \
  -F "pdf=@sample.pdf"
```
