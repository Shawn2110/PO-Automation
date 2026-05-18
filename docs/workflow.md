# workflow.md
**PO Automation System — User Workflows**
`BuildCo Infra Pvt. Ltd. · v1.0 · May 2025`

---

## Overview

This document describes every user-facing workflow in the system — from upload through to correction and export. Each workflow maps to specific UI screens and backend operations.

---

## Workflow 1 — Invoice Upload (Known Vendor)

**Actor:** Accountant or Admin
**Precondition:** Vendor has a saved template
**Expected outcome:** Invoice fully extracted and stored, status: Processed

```
User navigates to Upload page
         │
         ▼
Drags PDF onto upload zone (or clicks to browse)
         │
         ▼
Frontend validates: file type = PDF, size ≤ 20MB
         │
         ▼
POST /invoices/upload → returns job_id
         │
         ▼
UI shows processing animation
Frontend polls GET /invoices/job/:job_id every 2s
         │
         ▼
Pipeline runs (see agent.md for full detail):
  Stage 1 · Intake
  Stage 2 · OCR
  Stage 3 · Vendor detection → GST match found
  Stage 4 · Template applied → all 5 fields extracted
  Stage 5 · Validation → GST maths pass
  Stage 6 · Persisted
         │
         ▼
Job status: complete
UI shows extraction result card:
  · Invoice date
  · Invoice number
  · Client name
  · Amount before GST
  · Amount after GST
         │
         ▼
User clicks "View in invoices" → Invoice detail page
```

**Success criteria:** Invoice appears in dashboard with status Processed. All 5 fields populated. No manual intervention required.

---

## Workflow 2 — Invoice Upload (New Vendor)

**Actor:** Accountant or Admin
**Precondition:** Vendor has no saved template
**Expected outcome:** Template created, invoice extracted, status: Processed

```
User uploads PDF (same as Workflow 1 steps 1–4)
         │
         ▼
Pipeline runs:
  Stage 1 · Intake
  Stage 2 · OCR
  Stage 3 · Vendor detection → GST not found in DB
            New vendor record created
  Stage 4 · No template → status: needs_mapping
  Pipeline stops here
         │
         ▼
UI shows: "New vendor detected — mapping required"
Displays vendor name + GST number
         │
         ▼
User clicks "Map template" → Template Mapping UI
         │
         ▼
── TEMPLATE MAPPING UI ──

  Shows: rendered PDF preview (left)
         list of OCR-detected labels (right)

  For each of 5 canonical fields:
    User selects matching label from dropdown
    System highlights value on PDF preview

  All 5 fields mapped
         │
         ▼
User clicks "Save template"
POST /vendors/:id/template
         │
         ▼
Template saved to vendor_templates table
Pipeline re-runs stages 4–6 automatically
         │
         ▼
Invoice status: Processed
Notification: "Template saved. Future invoices from
               [vendor] will be extracted automatically."
```

**Success criteria:** Template saved. Invoice extracted. All future invoices from this vendor are Workflow 1 (automatic).

---

## Workflow 3 — Invoice Upload (Low Confidence)

**Actor:** Accountant or Admin
**Precondition:** OCR confidence < 0.70 (e.g., poor scan quality)
**Expected outcome:** Invoice flagged for review, accountant corrects values

```
Pipeline runs stages 1–5
Validation detects: overall confidence = 0.58
         │
         ▼
Invoice status: needs_review
User notified in dashboard (amber badge)
         │
         ▼
User opens invoice detail
Low-confidence fields highlighted in amber
         │
         ▼
User reviews PDF (rendered in panel)
Clicks field value → inline edit activates
Types correct value → Save
         │
         ▼
PATCH /invoices/:id
Field updated in DB
Audit log entry written:
  { action: 'corrected', field: 'amount_before_gst',
    old_value: '2,40,000', new_value: '2,45,000', user, timestamp }
         │
         ▼
All fields verified
User marks invoice as resolved (optional — admin can dismiss flag)
Invoice status: Processed
```

---

## Workflow 4 — Manual Field Correction

**Actor:** Accountant or Admin
**Precondition:** Invoice is Processed but contains a wrong value
**Expected outcome:** Field corrected, audit log updated, template hint improved

```
User finds invoice in dashboard
Opens invoice detail
         │
         ▼
User clicks incorrect field value
Inline edit input appears
         │
         ▼
User types correct value
Clicks Save (or presses Enter)
         │
         ▼
PATCH /invoices/:id  { field: 'client_name', value: 'Tata Steel Ltd' }
         │
         ▼
System:
  · Updates invoice record
  · Writes to audit_log
  · Updates vendor template bbox_hint for this field
    (improves future extraction accuracy)
  · Does NOT re-run OCR (correction is authoritative)
         │
         ▼
Field shows updated value
"Edited by [user] at [timestamp]" shown in detail
```

---

## Workflow 5 — Vendor Template Edit

**Actor:** Admin
**Precondition:** Existing template produces wrong extractions
**Expected outcome:** Template corrected, applies to all future invoices

```
Admin navigates to Vendors page
Finds vendor → clicks "Edit template"
         │
         ▼
Template Mapping UI loads with current mappings pre-filled
         │
         ▼
Admin changes one or more field mappings
Clicks "Save template"
         │
         ▼
PUT /vendors/:id/template
         │
         ▼
Template updated in vendor_templates table
Audit log entry written
         │
         ▼
All future invoices from this vendor use new mappings
Historical invoices are NOT re-processed
  (accountant can manually correct any that are wrong)
```

---

## Workflow 6 — Export

**Actor:** Viewer, Accountant, or Admin
**Precondition:** User has applied filters / date range for desired scope
**Expected outcome:** Downloaded CSV or XLSX file

```
User on Invoices page
Applies filters: vendor = "Tata Steel", date = Jan–Feb 2024
         │
         ▼
Clicks "Export CSV" or "Export Excel"
         │
         ▼
GET /invoices/export?vendor=...&from=...&to=...&format=csv
         │
         ▼
Server streams file download
         │
         ▼
File contains columns:
  Invoice Number · Vendor · GST Number · Invoice Date
  Client Name · Amount Before GST · Amount After GST
  GST % · Status · Uploaded By · Uploaded At
```

---

## Workflow 7 — User Management (Admin)

**Actor:** Admin
**Precondition:** New team member needs access

```
Admin navigates to Users page
Clicks "Add user"
         │
         ▼
Form: name, email, role (Admin / Accountant / Viewer)
         │
         ▼
POST /users
System creates user record (is_active: true)
Sends invite email with temporary password
         │
         ▼
New user receives email
Logs in → prompted to change password
         │
         ▼
User appears in Users table
Admin can edit role or deactivate at any time

── DEACTIVATE ──
Admin clicks deactivate on user
DELETE /users/:id (soft delete — is_active: false)
User cannot log in
All their invoices / audit entries are retained
```

---

## Status State Machine

Every invoice moves through the following states:

```
                 ┌─────────┐
   Upload ──────▶│ queued  │
                 └────┬────┘
                      │ Celery picks up task
                      ▼
                 ┌──────────────┐
                 │  processing  │
                 └──────┬───────┘
                        │
          ┌─────────────┼──────────────┐
          │             │              │
          ▼             ▼              ▼
    ┌──────────┐  ┌────────────┐  ┌─────────┐
    │processed │  │needs_review│  │  needs  │
    │          │  │            │  │ mapping │
    └──────────┘  └─────┬──────┘  └────┬────┘
                        │              │
                   User corrects  User maps
                   fields         template
                        │              │
                        ▼              ▼
                   ┌──────────┐  ┌──────────┐
                   │processed │  │processing│──▶ processed
                   └──────────┘  └──────────┘

    ┌────────┐
    │ error  │  OCR catastrophic failure or corrupt PDF
    └────────┘  Admin must re-upload or mark as manual
```

---

*Document owner: BuildCo Infra Technology Team*
*Status: APPROVED FOR DEVELOPMENT*
