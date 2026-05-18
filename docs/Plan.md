# Plan.md
**PO Automation System — Product Plan**
`BuildCo Infra Pvt. Ltd. · v1.0 · May 2025`

---

## Overview

PO Automation is an internal web application for BuildCo Infra Pvt. Ltd. that ingests vendor invoice PDFs, extracts 5 canonical financial fields using OCR and a vendor template engine, and stores structured records for accounting review and export.

The system eliminates manual data entry from the invoice processing workflow. Every invoice — regardless of vendor format — is processed through the same pipeline and stored as a structured record with full audit history.

---

## Problem Statement

BuildCo Infra processes between 500 and 5,000 invoices per month from a mix of repeat and new vendors. Each vendor uses a different invoice format — field names, layouts, and label conventions vary significantly.

**Current process:**

1. Accountant receives invoice PDF via email or WhatsApp
2. Accountant manually reads the PDF and types field values into a spreadsheet
3. Senior accountant reviews and approves
4. Data is re-entered into Tally

**Pain points:**

- Manual entry takes 3–8 minutes per invoice
- Transcription errors occur in roughly 4% of invoices (internal estimate)
- No central searchable record of processed invoices
- New team members require 2–3 weeks to learn all vendor formats
- Audit trail is nonexistent — no record of who entered what or when

**Root cause:** No single system that can read arbitrary vendor invoice formats and map them to canonical fields without per-vendor manual configuration that accumulates over time.

---

## Goals & Success Metrics

### Primary Goals

| Goal | Metric | Target |
|---|---|---|
| Reduce manual entry time | Minutes per invoice | < 30 seconds (from 3–8 min) |
| Reduce transcription errors | Error rate | < 0.5% (from ~4%) |
| Enable searchable invoice archive | Query response time | < 500ms |
| Automate repeat vendors | % auto-extracted without review | > 85% by month 3 |
| Enable audit trail | % invoices with full history | 100% |

### Secondary Goals

- New accountant onboarding time reduced from 3 weeks to < 3 days
- Vendor template library covers 90% of invoice volume within 60 days of launch

---

## Scope

### v1.0 — In Scope

| Feature | Notes |
|---|---|
| PDF upload + OCR extraction | PaddleOCR, all PDF types |
| Vendor template mapping | One-time per vendor |
| Invoice dashboard + search | Paginated, filterable |
| CSV / Excel export | Current filtered view |
| Role-based access (3 roles) | Admin, Accountant, Viewer |
| GST validation | Maths check + flag |

### v1.0 — Out of Scope

| Feature | Notes |
|---|---|
| ERP / Tally integration | Planned v2.0 |
| Automated payment processing | Not in scope |
| Purchase order matching | Future |
| Email ingestion | Future |
| Mobile native app | Responsive web only |
| Multi-company / multi-entity | Single entity only |

---

## User Roles & Permissions

Three roles, enforced at both frontend and API level.

```
Admin
 ├── All Accountant permissions
 ├── Manage users (create, edit, delete, assign roles)
 ├── Edit / delete vendor templates
 ├── View audit log
 └── Delete invoices

Accountant
 ├── All Viewer permissions
 ├── Upload invoice PDFs
 ├── Create and save vendor templates (one-time mapping)
 ├── Edit extracted field values on any invoice
 └── Export CSV / Excel

Viewer
 ├── View all invoices (read-only)
 ├── Search and filter invoices
 └── Export CSV / Excel
```

**Auth mechanism:** JWT-based session auth. Tokens expire after 8 hours. No SSO in v1.0.

---

## Open Questions

1. **ERP integration timeline** — Is Tally integration in scope for v2.0? If yes, which Tally version (Prime / ERP 9)?
2. **Email ingestion** — Should the system eventually accept invoices forwarded to an inbox (e.g., `invoices@buildco.in`)?
3. **GST filing** — Will extracted data need to feed into GSTR-2A reconciliation?
4. **Multi-page invoices** — Some construction invoices run to 8–12 pages. Is page 1 extraction sufficient?
5. **Vendor name changes** — When a vendor rebrands or changes GST number, how should historical invoices be handled?
6. **Hosting region** — Is there a requirement for data to remain within India for compliance?
7. **Offline access** — Does any user need to access or upload invoices without internet connectivity?

---

*Document owner: BuildCo Infra Technology Team*
*Next review: 30 days post-Phase 1 kickoff*
*Status: APPROVED FOR DEVELOPMENT*
