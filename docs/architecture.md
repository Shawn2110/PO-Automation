# architecture.md
**PO Automation System — System Architecture**
`BuildCo Infra Pvt. Ltd. · v1.0 · May 2025`

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│                                                             │
│   Next.js 14 (App Router) · Tailwind CSS · React Query     │
│                                                             │
│   Desktop view ────────────────── Mobile view              │
│   Full table + sidebar          Card list + bottom nav      │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTPS · REST · JSON
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                        API LAYER                             │
│                                                             │
│   FastAPI (Python 3.11)                                     │
│   · JWT authentication middleware                           │
│   · Role-based route guards                                 │
│   · Request validation (Pydantic)                           │
│   · Rate limiting: 100 req/min per user                     │
└──────────┬─────────────────────────────┬────────────────────┘
           │                             │
┌──────────▼──────────┐    ┌────────────▼──────────────────┐
│   PROCESSING LAYER  │    │        STORAGE LAYER          │
│                     │    │                               │
│  Celery + Redis     │    │  PostgreSQL 15                │
│  Async job queue    │    │  · invoices                   │
│                     │    │  · vendors                    │
│  PaddleOCR          │    │  · vendor_templates           │
│  PP-StructureV3     │    │  · users                      │
│  Text + layout      │    │  · audit_log                  │
│                     │    │                               │
│  Vendor matcher     │    │  MinIO (S3-compatible)        │
│  GST number lookup  │    │  Original PDFs                │
│                     │    │                               │
│  Template engine    │    │  Redis                        │
│  Field extractor    │    │  Job queue + session cache    │
│                     │    │                               │
│  RapidFuzz          │    │                               │
│  Fuzzy label match  │    │                               │
└─────────────────────┘    └───────────────────────────────┘
```

---

## Deployment Architecture

All services run as Docker containers via `docker-compose`. Single VPS deployment in v1.0.
Target: **Hetzner CX31** (2 vCPU, 8GB RAM) at ~€10/month.

```
                    ┌─────────────────┐
                    │   Reverse Proxy │
                    │     Nginx       │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌─────▼──────┐ ┌───▼────────────┐
     │  Next.js app  │ │  FastAPI   │ │  MinIO         │
     │  :3000        │ │  :8000     │ │  :9000         │
     └───────────────┘ └─────┬──────┘ └────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌─────▼──────┐ ┌───▼────────────┐
     │  PostgreSQL   │ │   Redis    │ │  Celery Worker │
     │  :5432        │ │  :6379     │ │  (2 workers)   │
     └───────────────┘ └────────────┘ └────────────────┘
```

---

## Layer Breakdown

### Client Layer — Next.js 14

- App Router with server and client components
- Tailwind CSS for responsive layout (desktop + mobile breakpoints)
- React Query for all API state — caching, polling, optimistic updates
- WebSocket client for live job status updates
- httpOnly cookie for JWT (no localStorage)

**Responsive strategy:**

| Viewport | Layout |
|---|---|
| Desktop (≥ 900px) | Fixed sidebar + full data table |
| Mobile (< 900px) | Bottom nav + card-per-invoice list |

---

### API Layer — FastAPI

- Python 3.11, async handlers throughout
- Pydantic v2 models for request/response validation
- JWT middleware on all protected routes
- Role guard decorator per endpoint
- Rate limiting: 100 requests/min per authenticated user
- Structured JSON logging via structlog
- Auto-generated OpenAPI docs at `/docs`

---

### Processing Layer — Celery + PaddleOCR

**Job queue:** Celery with Redis as broker. Two worker processes in v1.0.

**OCR engine:** PaddleOCR PP-StructureV3
- Handles both digital and scanned PDFs
- Outputs: text content, bounding box coordinates, confidence score per region
- Layout analysis: detects tables, columns, header/footer zones
- Runs on CPU — no GPU required

**PDF rendering:** PyMuPDF (fitz) converts PDF pages to images for OCR input.

**Fuzzy matching:** RapidFuzz (Apache 2.0) for label matching when exact match fails.
- Threshold: score ≥ 80 accepted automatically
- Score < 80: falls through to position heuristic or flags for review

---

### Storage Layer

| Store | Technology | Purpose |
|---|---|---|
| Relational DB | PostgreSQL 15 | Invoices, vendors, users, audit log |
| File store | MinIO (self-hosted S3) | Original PDF files |
| Cache / queue | Redis 7 | Celery broker + session cache |

**PostgreSQL notes:**
- UUID primary keys throughout
- JSONB column for bounding box hints (vendor_templates)
- Generated column for GST amount (amount_after_gst − amount_before_gst)
- Unique constraint: (invoice_number, vendor_id) for duplicate detection

**MinIO notes:**
- Same API as AWS S3 — can migrate to S3 in future with no code changes
- Lifecycle policy: move PDFs > 1 year to cold storage tier
- Bucket: `buildco-invoices` with private ACL

---

## Tech Stack

### Frontend

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR, routing, API routes |
| Styling | Tailwind CSS + custom CSS variables | Design system control |
| State | React Query (TanStack) | Server state, caching, polling |
| Auth | next-auth + httpOnly cookie | Secure JWT handling |
| Charts | Recharts | Lightweight, composable |
| Export | SheetJS (xlsx) | Client-side Excel generation |

### Backend

| Layer | Choice | Reason |
|---|---|---|
| Framework | FastAPI (Python 3.11) | Async, Pydantic, auto-docs |
| Task queue | Celery + Redis | Async PDF processing |
| OCR | PaddleOCR PP-StructureV3 | Best CPU accuracy, table-aware |
| PDF → image | PyMuPDF (fitz) | Fast, no external deps |
| Fuzzy match | RapidFuzz | Apache 2.0, faster than fuzzywuzzy |
| Auth | python-jose + passlib | JWT + bcrypt |
| ORM | SQLAlchemy 2.0 + Alembic | Async queries, migrations |

### Infrastructure

| Layer | Choice | Reason |
|---|---|---|
| Database | PostgreSQL 15 | ACID, JSONB for bbox hints |
| File store | MinIO (self-hosted S3) | No S3 costs, same API |
| Cache / queue | Redis 7 | Celery broker + session cache |
| Proxy | Nginx | SSL termination, static files |
| Containers | Docker + Docker Compose | Reproducible deploys |
| Hosting | Hetzner CX31 VPS | ~€10/mo, EU data residency |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OCR accuracy low on certain vendor formats | Medium | High | Manual review fallback; confidence threshold gating |
| PaddleOCR slow on large PDFs (> 10 pages) | Low | Medium | Page limit warning on > 5 pages; async processing hides latency |
| New vendor flood: many unmapped vendors at launch | High | Medium | Pre-map top 20 vendors by volume before launch |
| GST number absent from invoice | Medium | Medium | Fall back to vendor name fuzzy match; flag for confirmation |
| VPS disk fills up with PDFs | Low | High | MinIO lifecycle policy: cold storage after 1 year |
| Accountant maps template incorrectly | Low | High | Correction flow updates template; admin can delete and redo |
| Duplicate invoice uploaded | Medium | Low | Unique constraint on (invoice_number, vendor_id); user notified |

---

*Document owner: BuildCo Infra Technology Team*
*Status: APPROVED FOR DEVELOPMENT*
