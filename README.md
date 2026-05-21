# PO Automation

Internal vendor-invoice extraction system for BuildCo Infra. This repo holds:

- `docs/` — PRD, architecture, build plan, agent pipeline spec, workflows
- `po-dashboard.jsx` — Phase 0 POC (1051-line static React frontend with dummy data)
- `web/` — **Next.js 16 demo app** (frontend + API + DB)
- `modal-vlm/` — **Modal sidecar** running Qwen2.5-VL-7B-AWQ on an L4 GPU for invoice extraction
- `archive/ocr-service/` — Phase 1 Tesseract OCR sidecar, kept for reference (replaced by `modal-vlm/`)

The demo is deliberately structured so each piece can be swapped for its production counterpart without rewriting business logic. See [Upgrade path](#upgrade-path).

---

## Quick start

### 1. Modal VLM sidecar (one-time deploy)

```powershell
cd modal-vlm
pip install modal
modal token new
modal secret create po-automation-secrets MODAL_AUTH_TOKEN=<random-32-char-hex>
modal deploy app.py
```

`modal deploy` prints a stable URL — that's your `MODAL_VLM_URL`. See `modal-vlm/README.md` for details. First deploy pulls ~14GB of Qwen weights into the Modal Volume; subsequent deploys reuse the cache.

### 2. Next.js web app

```powershell
cd web
npm install
# Set web/.env from web/.env.example with:
#   DATABASE_URL=<your Postgres>
#   MODAL_VLM_URL=<from step 1>
#   MODAL_AUTH_TOKEN=<same as the Modal secret>
npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://localhost:3000>. Sign in with one of the seeded accounts:

| Role | Email | Password |
|---|---|---|
| Accountant | `accountant@buildco.in` | `accountant123` |
| Viewer | `viewer@buildco.in` | `viewer123` |

---

## What works in the demo

| Feature | Status | Notes |
|---|---|---|
| Auth.js v5 credentials login + JWT cookie | ✅ | 2 seeded users, role-based proxy |
| Role-based access on every route | ✅ | Accountant = read/write, Viewer = read-only |
| Dashboard with live counts | ✅ | Queried directly from Prisma |
| Invoices list with status filter + search | ✅ | URL-driven filters; deep-linkable |
| Invoice detail with inline edit + audit log | ✅ | PATCH writes one audit row per changed field |
| PDF upload (drag/drop, 20MB limit, magic-byte check) | ✅ | Saved to `web/uploads/` |
| Qwen2.5-VL extraction pipeline | ✅ | Single VLM call, returns six fields as JSON via guided decoding |
| Vendor upsert via GST number | ✅ | Auto-creates on new GSTIN, increments invoice count on repeat |
| Duplicate detection | ✅ | `UNIQUE(invoice_number, vendor_id)` returns a friendly P2002 message |
| CSV + XLSX export of filtered view | ✅ | Date range + status filters |

## What's deliberately deferred

| Out of demo scope | Lives in upgrade path |
|---|---|
| MinIO / S3 storage | Adapter behind `web/lib/storage.ts` |
| Redis + Celery for the pipeline | `runPipeline` is structured to drop into a worker |
| WebSocket live updates | Replaced with 800ms polling |
| Multi-page PDF support | Qwen reads page 1 only |
| Buyer name extraction | Hardcoded to "BuildCo Infra Pvt Ltd" — most GST invoices put it in inconsistent positions |

---

## Project layout

```
.
├── docs/                          PRD / architecture / agent spec
├── po-dashboard.jsx               Phase 0 POC reference
├── archive/ocr-service/           Phase 1 Tesseract sidecar (no longer deployed)
│
├── modal-vlm/                     Qwen2.5-VL-7B-AWQ on Modal L4
│   ├── app.py                     Modal app + FastAPI /extract endpoint
│   ├── requirements.txt
│   └── README.md
│
├── web/                           Next.js 16 (frontend + API + DB)
│   ├── app/
│   │   ├── (app)/                 Authenticated shell (sidebar + topbar)
│   │   │   ├── dashboard/
│   │   │   ├── invoices/[id]/
│   │   │   ├── upload/
│   │   │   └── vendors/[id]/template/  (legacy — orphaned after VLM swap)
│   │   ├── login/                 Public
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       ├── invoices/
│   │       │   ├── upload/        POST PDF
│   │       │   ├── export/        CSV / XLSX
│   │       │   └── [id]/
│   │       │       ├── route.ts   GET / PATCH
│   │       │       └── job/       polling endpoint
│   │       └── vendors/[id]/template/  (legacy)
│   ├── lib/
│   │   ├── db.ts                  Prisma client singleton
│   │   ├── ocr.ts                 HTTP client → Modal VLM
│   │   ├── storage.ts             Local-disk adapter (swap for S3)
│   │   ├── pipeline.ts            Single-stage VLM orchestrator
│   │   └── extraction/            Legacy template matcher (kept for parse.ts utilities)
│   ├── components/                Shared UI (Sidebar, Topbar, Icons, badges, editors)
│   ├── prisma/
│   │   ├── schema.prisma          PostgreSQL
│   │   └── seed.ts                Idempotent demo data
│   ├── auth.ts                    Auth.js v5 (NextAuth) config
│   ├── auth.config.ts             Edge-safe slice (no DB)
│   ├── proxy.ts                   Route gating (renamed from middleware.ts in Next 16)
│   └── uploads/                   PDFs land here (gitignored)
│
└── render.yaml                    Blueprint for Render: web service + env vars
```

---

## Upgrade path

Every piece below has a clean swap point — replace the implementation, not the call sites.

### Local file storage → MinIO / S3

Replace `web/lib/storage.ts`'s `saveUploadedPdf` with a presigned-PUT to MinIO or a direct `PutObject` call. The pipeline reads bytes from disk before calling Modal — change it to fetch from S3 instead.

### In-process pipeline → Celery / queue worker

`web/lib/pipeline.ts` is structured so the function body becomes a worker task verbatim. The upload route currently does `runPipeline(inv.id).catch(...)` — swap that for an enqueue call. The job-status endpoint already polls the DB, so no client changes needed.

### Qwen2.5-VL-7B-AWQ → fine-tuned Donut / LayoutLMv3

Once BuildCo has 500+ labeled invoices, swap `modal-vlm/app.py` for a fine-tuned Donut or LayoutLMv3 model on the same Modal infrastructure. The HTTP contract (`/extract` → six-field JSON) stays the same; only the model loader and inference call change.

### Auth.js JWT → SSO / OIDC

Add an OIDC provider to `auth.ts`. The session shape (`{ id, email, role }`) stays the same — every consumer of `auth()` is unchanged.

### Polling → WebSockets

Replace the 800ms `fetch` in `web/app/(app)/upload/UploadClient.tsx` with a WebSocket subscription. The pipeline already writes status to the DB at every stage.

---

## Troubleshooting

**`Could not reach Modal VLM at <URL>`**
The Modal app isn't deployed, or `MODAL_VLM_URL` is wrong. Run `cd modal-vlm && modal deploy app.py` and paste the printed URL into `web/.env` / Render env.

**`Modal VLM returned 401`**
`MODAL_AUTH_TOKEN` on the web side doesn't match the secret on Modal. Verify:
```
modal secret list                       # shows po-automation-secrets
modal secret get po-automation-secrets  # prints the values
```
Then check `web/.env` and Render's env tab match.

**First upload is slow (~30s)**
Expected — Modal L4 container is cold and loading Qwen weights from the Volume. Subsequent uploads on the warm container are ~5–10s. Containers spin down after 5 min idle (configurable in `app.py`).

**Login redirects in a loop**
Make sure `AUTH_SECRET` is set. The seed script must also have run — `npm run db:seed`.

**`Already uploaded — invoice X from Y was processed on Z`**
Working as designed — schema has `UNIQUE (invoice_number, vendor_id)` for duplicate detection (PRD §5.2). Use a fresh PDF or `SEED_RESET=true npm run db:seed` to reset.

---

*See `docs/build.md` for the full phased delivery plan, `docs/agent.md` for the original OCR pipeline spec (now superseded by the Qwen-VL approach).*
