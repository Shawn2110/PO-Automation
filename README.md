# PO Automation — Demo

Internal vendor-invoice extraction system for BuildCo Infra. This repo holds:

- `docs/` — PRD, architecture, build plan, agent pipeline spec, workflows
- `po-dashboard.jsx` — Phase 0 POC (1051-line static React frontend with dummy data)
- `web/` — **Next.js 16 demo app** (frontend + API + DB)
- `ocr-service/` — **Python FastAPI sidecar** for OCR (PaddleOCR / Tesseract)

The demo is deliberately structured so each piece can be swapped for its production counterpart without rewriting business logic. See [Upgrade path](#upgrade-path).

---

## Quick start

You need **two terminals** open.

### Terminal 1 — OCR sidecar

```powershell
cd ocr-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Windows users: install Tesseract binary from
#   https://github.com/UB-Mannheim/tesseract/wiki
python app.py
```

Wait until you see `Uvicorn running on http://127.0.0.1:8001`.

### Terminal 2 — Next.js web app

```powershell
cd web
npm install
npm run db:migrate    # apply Prisma migrations to SQLite
npm run db:seed       # 3 users, 3 vendors (2 with templates), 5 sample invoices
npm run dev
```

Open <http://localhost:3000>. Sign in with one of the seeded accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@buildco.in` | `admin123` |
| Accountant | `accountant@buildco.in` | `accountant123` |
| Viewer | `viewer@buildco.in` | `viewer123` |

---

## What works in the demo

| Feature | Status | Notes |
|---|---|---|
| Auth.js v5 credentials login + JWT cookie | ✅ | 3 seeded users, role-based proxy |
| Role-based access on every route | ✅ | Sidebar nav filters by role; users page admin-only |
| Dashboard with live counts | ✅ | Queried directly from Prisma |
| Invoices list with status filter + search | ✅ | URL-driven filters; deep-linkable |
| Invoice detail with inline edit + audit log | ✅ | PATCH writes one audit row per changed field |
| PDF upload (drag/drop, 20MB limit, magic-byte check) | ✅ | Saved to `web/uploads/` |
| OCR pipeline (Stage 2–6 from `docs/agent.md`) | ✅ | Runs in-process for the demo |
| Vendor detection via GST regex | ✅ | Auto-creates new vendor record |
| Template matching (exact → fuzzy → adjacent value) | ✅ | RapidFuzz-equivalent Levenshtein |
| GST validation (derived vs. declared, ±0.5%) | ✅ | `gst_mismatch` flag persisted |
| New-vendor template mapping UI | ✅ | OCR labels populate the dropdowns |
| CSV + XLSX export of filtered view | ✅ | Date range + status filters |

## What's deliberately deferred

| Out of demo scope | Lives in upgrade path |
|---|---|
| Postgres + MinIO + Redis + Celery + Docker | All swappable behind adapters |
| WebSocket live updates | Replaced with 800ms polling |
| Multi-page PDF support | Stage 2 rasterizes page 1 only |
| Production PaddleOCR | Optional engine — Tesseract fallback active by default |

---

## Project layout

```
.
├── docs/                          PRD / architecture / agent spec
├── po-dashboard.jsx               Phase 0 POC reference
│
├── web/                           Next.js 16 (frontend + API + DB)
│   ├── app/
│   │   ├── (app)/                 Authenticated shell (sidebar + topbar)
│   │   │   ├── dashboard/
│   │   │   ├── invoices/[id]/
│   │   │   ├── upload/
│   │   │   ├── vendors/[id]/template/
│   │   │   └── users/
│   │   ├── login/                 Public
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       ├── invoices/
│   │       │   ├── upload/        POST PDF
│   │       │   ├── export/        CSV / XLSX
│   │       │   └── [id]/
│   │       │       ├── route.ts   GET / PATCH
│   │       │       └── job/       polling endpoint
│   │       └── vendors/[id]/template/
│   ├── lib/
│   │   ├── db.ts                  Prisma client singleton
│   │   ├── ocr.ts                 HTTP client → Python sidecar
│   │   ├── storage.ts             Local-disk adapter (swap for S3)
│   │   ├── pipeline.ts            Stages 3–6 orchestrator
│   │   └── extraction/            Template match, parsing, GST validation
│   ├── components/                Shared UI (Sidebar, Topbar, Icons, badges, editors)
│   ├── prisma/
│   │   ├── schema.prisma          Mirrors docs/prd.md SQL
│   │   └── seed.ts                Demo data
│   ├── auth.ts                    Auth.js v5 (NextAuth) config
│   ├── auth.config.ts             Edge-safe slice (no DB)
│   ├── proxy.ts                   Route gating (renamed from middleware.ts in Next 16)
│   └── uploads/                   PDFs land here (gitignored)
│
└── ocr-service/                   Python FastAPI sidecar
    ├── app.py                     FastAPI endpoints (/health, /extract)
    ├── ocr_engine.py              Paddle + Tesseract adapters w/ auto-fallback
    ├── requirements.txt
    └── README.md
```

---

## Upgrade path

Every piece below has a clean swap point — replace the implementation, not the call sites.

### SQLite → Postgres
1. Change `provider = "postgresql"` and `DATABASE_URL` in `prisma/schema.prisma` + `.env`.
2. `npx prisma migrate deploy`.
3. SQLite-specific `contains` queries already work on Postgres; add `mode: "insensitive"` if you want case-insensitive search.

### Local file storage → MinIO / S3
Replace `web/lib/storage.ts`'s `saveUploadedPdf` with a presigned-PUT to MinIO or a direct `PutObject` call. The pipeline only reads `pdfPath` — make it an `s3://` URL or a presigned GET URL and the rest of the code is unchanged. The Python sidecar's `pdf_path` validator will need a matching update.

### In-process pipeline → Celery worker
`web/lib/pipeline.ts` is structured so the function body becomes a Celery task verbatim. The upload route currently does `runPipeline(inv.id).catch(...)` — swap that for an enqueue call. The job-status endpoint already polls the DB, so no client changes needed.

### Tesseract → PaddleOCR
Install `paddleocr` + `paddlepaddle` in the Python sidecar (Python 3.8–3.12 only). The engine auto-selects on startup; `/health` will report `engine: "paddleocr"`.

### Auth.js JWT → SSO / OIDC
Add an OIDC provider to `auth.ts`. The session shape (`{ id, email, role }`) stays the same — every consumer of `auth()` is unchanged.

### Polling → WebSockets
Replace the 800ms `fetch` in `web/app/(app)/upload/UploadClient.tsx` with a WebSocket subscription. The pipeline already writes status to the DB at every stage; a WebSocket emitter is one extra call inside `runPipeline`.

---

## Troubleshooting

**OCR sidecar errors `Could not reach OCR sidecar at http://127.0.0.1:8001`**
The sidecar isn't running. Start it with `python ocr-service/app.py`.

**`/health` returns `engine: null`**
Neither PaddleOCR nor Tesseract is installed. Install Tesseract from <https://github.com/UB-Mannheim/tesseract/wiki> and re-run `pip install -r requirements.txt`.

**Login redirects in a loop**
Make sure `AUTH_SECRET` is set in `web/.env`. The seed script must also have run — `npm run db:seed`.

**`Vendor with given GST exists` error after second upload of same invoice**
Working as designed — the schema has `UNIQUE (invoice_number, vendor_id)` for duplicate detection (PRD §5.2). Use a fresh PDF or `npm run db:seed` to reset.

---

*See `docs/build.md` for the full phased delivery plan, `docs/agent.md` for the OCR pipeline spec.*
