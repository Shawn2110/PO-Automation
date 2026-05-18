# agent.md
**PO Automation System — Extraction Agent Specification**
`BuildCo Infra Pvt. Ltd. · v1.0 · May 2025`

---

## Overview

The extraction agent is a 6-stage Celery task that runs asynchronously on the backend server. It receives an uploaded PDF and produces a structured invoice record with 5 canonical fields. Each stage is atomic — failures are caught, logged, and the invoice is moved to an appropriate error state without data loss.

---

## Pipeline Diagram

```
PDF Received
     │
     ▼
┌────────────────────────────────────────────────┐
│  STAGE 1 · INTAKE                              │
│                                                │
│  · Validate: file type, size, not corrupt      │
│  · Store original PDF → MinIO                  │
│  · Create invoice record (status: queued)      │
│  · Enqueue Celery task, return job_id          │
└──────────────────────┬─────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────┐
│  STAGE 2 · OCR                                 │
│                                                │
│  · Load PDF page(s) as image (PyMuPDF)        │
│  · Run PaddleOCR PP-StructureV3               │
│  · Output: [(text, bbox, confidence)]          │
│  · Compute overall page confidence score       │
│                                                │
│  IF confidence < 0.50 → ABORT, flag manual     │
└──────────────────────┬─────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────┐
│  STAGE 3 · VENDOR DETECTION                    │
│                                                │
│  · Scan OCR text for GST pattern              │
│    regex: [0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}   │
│            [0-9]{1}[A-Z]{1}                   │
│  · Lookup GST number in vendors table          │
│                                                │
│  IF match → load vendor + template             │
│  IF no match → create new vendor record        │
│               set flag: needs_template = true  │
└──────────────────────┬─────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────┐
│  STAGE 4 · TEMPLATE MATCHING                   │
│                                                │
│  IF vendor has template:                       │
│    For each canonical field:                   │
│      Tier 1: Exact match on OCR label          │
│              (normalised: lowercase, stripped) │
│      Tier 2: Fuzzy match via RapidFuzz ≥ 80   │
│      Tier 3: Bounding box proximity hint       │
│    Extract value adjacent to matched label     │
│    Compute per-field confidence                │
│                                                │
│  IF vendor has no template:                    │
│    Set status: needs_mapping                   │
│    Emit notification event                     │
│    STOP — await manual template creation       │
└──────────────────────┬─────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────┐
│  STAGE 5 · VALIDATION                          │
│                                                │
│  · Parse amounts: strip ₹, commas → float      │
│  · Parse date: normalise to ISO 8601           │
│  · GST check: (ag - bg) / bg ≈ declared rate   │
│    Tolerance: ± 0.5%                           │
│  · Invoice number: must be non-empty string    │
│                                                │
│  IF any field confidence < 0.70               │
│    → status: needs_review                      │
│  IF GST maths fail                            │
│    → flag: gst_mismatch = true                 │
└──────────────────────┬─────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────┐
│  STAGE 6 · PERSIST                             │
│                                                │
│  · Write canonical fields to invoices table    │
│  · Write extraction metadata to audit_log      │
│  · Update vendor.invoice_count + last_seen     │
│  · Update invoice status:                      │
│      processed / needs_review / needs_mapping  │
│  · Emit WebSocket event → frontend updates     │
└────────────────────────────────────────────────┘
```

---

## Stage Specifications

### Stage 1 — Intake

**Input:** Raw file bytes, user_id, filename

**Validations:**
- MIME type must be `application/pdf`
- Magic bytes: first 4 bytes must be `%PDF`
- File size ≤ 20MB
- PDF must open without error (PyMuPDF)

**Operations:**
1. Generate UUID for invoice record
2. Upload PDF to MinIO: `buildco-invoices/{uuid}.pdf`
3. Insert invoice row: `{ id, pdf_path, status: 'queued', uploaded_by, uploaded_at }`
4. Enqueue Celery task with `invoice_id`
5. Return `{ job_id, invoice_id }` to API

**On failure:** Invoice record not created. Error returned to user immediately.

---

### Stage 2 — OCR

**Input:** `invoice_id`, PDF path in MinIO

**Operations:**
1. Download PDF from MinIO to temp directory
2. Convert PDF pages to images: `fitz.open()` → `page.get_pixmap(dpi=150)`
3. Run PaddleOCR on each page image:
   ```python
   ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)
   result = ocr.ocr(image_path, cls=True)
   ```
4. Parse result into structured blocks:
   ```python
   Block(text=str, bbox=[x1,y1,x2,y2], confidence=float)
   ```
5. Compute overall confidence: `mean(block.confidence for all blocks)`
6. Update invoice: `{ status: 'processing', ocr_confidence: score }`

**Confidence threshold:**
- ≥ 0.70 → proceed
- 0.50–0.70 → proceed but flag for review post-extraction
- < 0.50 → abort, set `status: 'error'`, write audit log

**Output:** `List[Block]` passed to Stage 3

---

### Stage 3 — Vendor Detection

**Input:** `List[Block]` from Stage 2

**GST extraction:**
```python
import re
GST_PATTERN = re.compile(r'\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}\b')

gst_numbers = []
for block in blocks:
    matches = GST_PATTERN.findall(block.text.upper())
    gst_numbers.extend(matches)
```

**Vendor lookup:**
```python
vendor = db.query(Vendor).filter(Vendor.gst_number.in_(gst_numbers)).first()
```

**Outcomes:**

| Outcome | Action |
|---|---|
| GST match found, vendor has template | Load template → Stage 4 |
| GST match found, no template | Create vendor if new, set `needs_mapping` |
| No GST found | Try vendor name fuzzy match on OCR text |
| Name match found | Proceed with vendor, note: low confidence |
| No match at all | Create placeholder vendor, set `needs_mapping` |

**Output:** `vendor_id`, `template` (or None)

---

### Stage 4 — Template Matching

**Input:** `List[Block]`, `template: VendorTemplate`

**Three-tier matching per canonical field:**

```python
def match_field(blocks, template_label, bbox_hint=None):

    # Tier 1: Exact match (normalised)
    normalised_label = template_label.strip().lower()
    for block in blocks:
        if block.text.strip().lower() == normalised_label:
            return extract_adjacent_value(block, blocks), 1.0

    # Tier 2: Fuzzy match
    from rapidfuzz import fuzz
    best_score, best_block = 0, None
    for block in blocks:
        score = fuzz.ratio(block.text.lower(), normalised_label)
        if score > best_score:
            best_score, best_block = score, block
    if best_score >= 80:
        return extract_adjacent_value(best_block, blocks), best_score / 100

    # Tier 3: Bounding box proximity
    if bbox_hint:
        closest = min(blocks, key=lambda b: bbox_distance(b.bbox, bbox_hint))
        return extract_adjacent_value(closest, blocks), 0.6

    return None, 0.0
```

**Value extraction — `extract_adjacent_value`:**
- Looks for the next block to the right of the label (same row, ±20px Y)
- Falls back to the block directly below the label (next row)
- Returns raw text string of the value block

**Output:** `{ field: (raw_value, confidence) }` for all 5 fields

---

### Stage 5 — Validation

**Input:** Raw extracted values with confidence scores

**Amount parsing:**
```python
import re

def parse_amount(raw: str) -> float:
    cleaned = re.sub(r'[₹,\s]', '', raw)
    return float(cleaned)
```

Handles: `₹2,45,000` → `245000.0`, `2,89,100.00` → `289100.0`

**Date parsing:**
```python
from dateutil import parser

def parse_date(raw: str) -> date:
    return parser.parse(raw, dayfirst=True).date()
```

Handles: `15 Jan 2024`, `15/01/2024`, `2024-01-15`, `15-01-24`

**GST validation:**
```python
def validate_gst(bg: float, ag: float, declared_pct: float) -> bool:
    if bg <= 0 or ag <= 0:
        return False
    derived_pct = ((ag - bg) / bg) * 100
    return abs(derived_pct - declared_pct) <= 0.5
```

**Confidence gate:**
```python
LOW_CONFIDENCE_THRESHOLD = 0.70

any_low = any(conf < LOW_CONFIDENCE_THRESHOLD
              for _, conf in extracted_fields.values())

if any_low:
    invoice.status = 'needs_review'
else:
    invoice.status = 'processed'
```

**Output:** Validated `{ field: typed_value }` dict + `status` + `gst_mismatch` flag

---

### Stage 6 — Persist

**Input:** Validated fields, status, metadata

**Database writes (single transaction):**
```python
async with db.begin():
    # 1. Update invoice record
    await db.execute(
        update(Invoice)
        .where(Invoice.id == invoice_id)
        .values(
            invoice_date=fields['invoice_date'],
            invoice_number=fields['invoice_number'],
            client_name=fields['client_name'],
            amount_before_gst=fields['amount_before_gst'],
            amount_after_gst=fields['amount_after_gst'],
            gst_pct=derived_gst_pct,
            ocr_confidence=overall_confidence,
            gst_mismatch=gst_mismatch,
            status=status,
        )
    )

    # 2. Write audit log
    await db.execute(
        insert(AuditLog).values(
            invoice_id=invoice_id,
            action='extracted',
            metadata={
                'stage_confidences': per_field_confidences,
                'ocr_confidence': overall_confidence,
                'template_used': template_id is not None,
                'vendor_id': vendor_id,
            }
        )
    )

    # 3. Update vendor stats
    await db.execute(
        update(Vendor)
        .where(Vendor.id == vendor_id)
        .values(
            invoice_count=Vendor.invoice_count + 1,
            last_seen=date.today(),
        )
    )
```

**WebSocket event:**
```python
await ws_manager.broadcast({
    'event': 'invoice_processed',
    'invoice_id': str(invoice_id),
    'status': status,
    'vendor': vendor_name,
})
```

---

## Error Handling

| Stage | Error type | Action |
|---|---|---|
| 1 | Invalid file type | Reject immediately, return 400 |
| 1 | File too large | Reject immediately, return 413 |
| 2 | PDF cannot be opened | status: error, audit log, notify |
| 2 | OCR confidence < 0.50 | status: error, audit log, notify |
| 3 | GST not found | Attempt name match, then needs_mapping |
| 4 | No fields matched | status: needs_mapping |
| 4 | Partial fields matched | Proceed with matched, flag rest for review |
| 5 | Amount parse failure | Field confidence = 0, status: needs_review |
| 5 | Date parse failure | Field confidence = 0, status: needs_review |
| 5 | GST maths fail | Set gst_mismatch flag, do not block |
| 6 | DB write failure | Celery retry × 3, then status: error |

**Celery retry policy:**
```python
@celery.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,  # seconds
    autoretry_for=(DatabaseError, ConnectionError),
)
def process_invoice(self, invoice_id: str):
    ...
```

---

## Observability

Every stage writes a structured log entry:

```json
{
  "timestamp": "2024-02-15T10:23:41Z",
  "level": "info",
  "request_id": "req_abc123",
  "invoice_id": "inv_xyz789",
  "stage": 2,
  "stage_name": "ocr",
  "duration_ms": 1840,
  "ocr_confidence": 0.91,
  "block_count": 47,
  "vendor_id": null
}
```

Prometheus metrics exposed per stage:
- `extraction_stage_duration_seconds{stage}` — histogram
- `extraction_errors_total{stage, error_type}` — counter
- `extraction_confidence{vendor_id}` — gauge (rolling average)
- `celery_queue_depth` — gauge

---

*Document owner: BuildCo Infra Technology Team*
*Status: APPROVED FOR DEVELOPMENT*
