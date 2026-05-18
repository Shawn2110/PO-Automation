# build.md
**PO Automation System — Build Plan**
`BuildCo Infra Pvt. Ltd. · v1.0 · May 2025`

---

## Summary Timeline

```
Phase 0  ██████░░░░░░░░░░░░  POC (Complete)
Phase 1  ░░██████████████░░  Backend Foundation     Weeks 1–3
Phase 2  ░░░░░░░░████████░░  Frontend Integration   Weeks 4–5
Phase 3  ░░░░░░░░░░░░████░░  QA & Hardening         Weeks 6–7
Phase 4  ░░░░░░░░░░░░░░████  Pilot + Launch         Weeks 8–9
```

**Total:** 9 weeks from Phase 1 start
**Team:** 1 backend engineer, 1 frontend engineer, 1 QA (part-time from week 6)

---

## Phase 0 — POC (Complete)

**Duration:** 2 weeks
**Deliverable:** Static React frontend with dummy data, design system established

| Task | Status |
|---|---|
| Design system: Mineral Cartography (dark, amber, monospaced) | ✅ Done |
| Login with 3 role modes | ✅ Done |
| Dashboard with stat cards + invoice table | ✅ Done |
| Invoice detail view with GST breakdown | ✅ Done |
| Upload page with animated pipeline simulation | ✅ Done |
| Vendor list + template mapping UI | ✅ Done |
| Users page | ✅ Done |
| PRD, architecture, workflow docs | ✅ Done |

---

## Phase 1 — Backend Foundation

**Duration:** 3 weeks
**Owner:** Backend engineer
**Deliverable:** Working API + OCR pipeline + database

### Week 1 — Infrastructure

- [ ] Docker Compose setup: FastAPI, PostgreSQL, Redis, MinIO, Celery
- [ ] Database schema creation (all 5 tables)
- [ ] Alembic migrations configured
- [ ] MinIO bucket setup (`buildco-invoices`, private ACL)
- [ ] FastAPI project structure (routers, models, middleware)
- [ ] Pydantic v2 models for all request/response shapes
- [ ] JWT auth: login endpoint, middleware, role guard decorator
- [ ] Health check endpoint (`GET /health`)
- [ ] Structlog JSON logging configured

**Exit criteria:** `docker-compose up` starts all services. Login returns a valid JWT. Health check passes.

---

### Week 2 — OCR Pipeline

- [ ] PyMuPDF: PDF → image conversion (per page, 150 DPI)
- [ ] PaddleOCR PP-StructureV3 integration
- [ ] OCR output parser: text, bounding box, confidence per region
- [ ] Overall page confidence score calculation
- [ ] GST number regex extractor: `[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}`
- [ ] Celery task: full 6-stage pipeline wired up
- [ ] MinIO upload in Stage 1 (store original PDF)
- [ ] Job status polling endpoint (`GET /invoices/job/:job_id`)
- [ ] WebSocket emitter for job status events

**Exit criteria:** Upload a real invoice PDF via API → OCR runs → GST number extracted → job status reachable via polling.

---

### Week 3 — Template Engine & CRUD

- [ ] Vendor lookup by GST number (DB query)
- [ ] New vendor creation when GST not found
- [ ] Template application: exact label match (case-insensitive)
- [ ] Template application: RapidFuzz fuzzy match (threshold 80)
- [ ] Bounding box proximity hint as fallback
- [ ] Value extraction adjacent to matched label
- [ ] Per-field confidence scoring
- [ ] Amount parsing: strip ₹, commas, spaces → float
- [ ] Date parsing: normalise to ISO 8601
- [ ] GST maths validation: `(ag - bg) / bg ≈ gst_pct ± 0.5%`
- [ ] Audit log writes for all pipeline events
- [ ] Full CRUD: `invoices`, `vendors`, `vendor_templates`, `users`
- [ ] Export endpoint: CSV + XLSX (openpyxl)

**Exit criteria:** Full pipeline works end-to-end for a known vendor. New vendor is flagged correctly. All CRUD endpoints return correct data with role guards enforced.

---

## Phase 2 — Frontend Integration

**Duration:** 2 weeks
**Owner:** Frontend engineer
**Deliverable:** Fully connected frontend — no dummy data remains

### Week 4 — Core Integration

- [ ] React Query setup with base API client
- [ ] Auth flow: real login form → JWT stored in cookie → protected routes
- [ ] Auto sign-out after 8 hours of inactivity
- [ ] Upload: real PDF upload → Celery job → polling → live status animation
- [ ] Invoice list: paginated API response → table render
- [ ] Filter by status (API query param)
- [ ] Search by invoice number / vendor name (API query param)
- [ ] Invoice detail: real data from `GET /invoices/:id`

**Exit criteria:** Can log in as each role. Can upload a PDF and see it processed. Invoice list loads from DB.

---

### Week 5 — Full Feature Completion

- [ ] Inline field edit → `PATCH /invoices/:id` → optimistic update
- [ ] Vendor template mapping UI → `POST /vendors/:id/template`
- [ ] WebSocket: live dashboard updates when new invoice is processed
- [ ] Export: CSV download via `GET /invoices/export`
- [ ] Export: XLSX download
- [ ] User management: create, edit role, deactivate (`/users` endpoints)
- [ ] Mobile responsive layout: card list view, bottom navigation
- [ ] Error states: upload failure, OCR failure, network error, session expiry
- [ ] Empty states: no invoices, no vendors, no users
- [ ] Loading skeletons on all data-heavy views

**Exit criteria:** All 10 PRD features working end-to-end. Mobile layout tested on 375px viewport. All error states handled gracefully.

---

## Phase 3 — QA & Hardening

**Duration:** 2 weeks
**Owner:** Backend engineer + QA

### Week 6 — Testing

**Backend:**
- [ ] Unit tests: OCR parser (pytest)
- [ ] Unit tests: template engine — exact match, fuzzy match, no match
- [ ] Unit tests: validation — amount parsing, date normalisation, GST maths
- [ ] Integration tests: all API endpoints, all 3 roles (pytest + httpx)
- [ ] Pipeline integration test: upload PDF → assert extracted fields in DB

**Frontend:**
- [ ] E2E tests: upload → extraction → correction flow (Playwright)
- [ ] E2E tests: template mapping flow for new vendor
- [ ] E2E tests: export CSV / XLSX

**OCR accuracy:**
- [ ] Test set: 50 real invoices from 10 vendors
- [ ] Target: > 90% field accuracy on known vendors
- [ ] Document any vendor formats that require special handling

**Performance:**
- [ ] 50 concurrent uploads: all complete within 60 seconds
- [ ] Invoice list query: < 500ms for 10,000 rows
- [ ] Export: < 5 seconds for 1,000 rows

**Exit criteria:** All unit and integration tests pass. E2E suite green. OCR accuracy > 90% on test set.

---

### Week 7 — Security & Hardening

**Security:**
- [ ] File upload validation: MIME type + magic bytes (not filename only)
- [ ] PDF content sanitisation (reject embedded scripts)
- [ ] SQL injection: all queries via ORM, no raw SQL with user input
- [ ] XSS: all user-supplied content escaped in frontend
- [ ] CORS: whitelist production domain only
- [ ] Rate limiting: 100 req/min per user, 10 uploads/min per user
- [ ] Brute force protection on login (5 attempts → 15 min lockout)
- [ ] Audit log cannot be deleted or modified (append-only)

**Reliability:**
- [ ] Celery task retry: 3 attempts with exponential backoff on OCR failure
- [ ] Dead letter queue for permanently failed jobs
- [ ] Database connection pool: max 20 connections
- [ ] Graceful shutdown: in-progress Celery jobs complete before container stop

**Observability:**
- [ ] Prometheus metrics endpoint (`/metrics`)
- [ ] Grafana dashboard: job queue depth, OCR latency, error rate
- [ ] Sentry error tracking (backend + frontend)
- [ ] Structured logs with request ID correlation

**Exit criteria:** Security checklist complete. No critical findings. Monitoring stack deployed.

---

## Phase 4 — Pilot & Launch

**Duration:** 2 weeks

### Week 8 — Internal Pilot

- [ ] Deploy to staging server (Hetzner CX31)
- [ ] SSL certificate via Let's Encrypt (Certbot)
- [ ] Nginx reverse proxy config
- [ ] Daily database backup: `pg_dump` → MinIO `buildco-backups` bucket
- [ ] Onboard 2 accountants for pilot
- [ ] Pre-map top 20 vendors by invoice volume
- [ ] Process 100 real invoices across 20 vendors
- [ ] Collect metrics: auto-extraction rate, errors, user feedback
- [ ] Bug bash: fix all P0 and P1 issues

**Target metrics by end of week 8:**
- ≥ 80% invoices auto-extracted without review
- Zero data loss events
- Zero security incidents

---

### Week 9 — Production Launch

- [ ] All pilot bugs resolved
- [ ] Production deployment (same server, swap Nginx config)
- [ ] Invite all users via admin panel
- [ ] User guide for accountants (PDF, < 5 pages)
- [ ] Admin runbook: how to restart services, check logs, restore backup
- [ ] Go/no-go review with stakeholders
- [ ] **Go-live**

**Post-launch (week 10+):**
- Monitor auto-extraction rate weekly
- Target: > 85% by end of month 3
- Collect vendor template requests — new vendors added within 24h of first invoice

---

## Definition of Done

A feature is done when:

1. Code is reviewed and merged to `main`
2. Unit tests pass (coverage ≥ 80% for backend logic)
3. E2E test covers the happy path
4. Error states are handled and tested
5. Mobile layout is verified at 375px
6. No TypeScript or Python type errors
7. Documented in relevant `.md` file if it changes the system behaviour

---

*Document owner: BuildCo Infra Technology Team*
*Status: APPROVED FOR DEVELOPMENT*
