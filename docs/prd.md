# prd.md
**PO Automation System — Product Requirements Document**
`BuildCo Infra Pvt. Ltd. · v1.0 · May 2025`

---

## Feature Requirements

### 5.1 Authentication

- [ ] Login screen with email + password
- [ ] Role selection is server-assigned (not user-selectable in prod)
- [ ] JWT stored in httpOnly cookie
- [ ] Auto sign-out after 8 hours of inactivity
- [ ] Password reset via email (admin-triggered in v1.0)

---

### 5.2 Invoice Upload

- [ ] Drag-and-drop PDF upload (max 20MB per file)
- [ ] Batch upload: up to 10 PDFs at once
- [ ] Upload triggers async processing job (Celery)
- [ ] Real-time status: Queued → Processing → Complete / Review required
- [ ] Duplicate detection: reject if same invoice number + vendor already exists

---

### 5.3 OCR Pipeline

- [ ] All PDFs processed through PaddleOCR (PP-StructureV3)
- [ ] OCR output: raw text with bounding box coordinates
- [ ] Layout analysis: detect tables, columns, header/footer zones
- [ ] Confidence score per extracted region (0.0 – 1.0)
- [ ] Invoices with overall OCR confidence < 0.70 flagged for manual review

---

### 5.4 Vendor Template Engine

- [ ] Vendor identified by GST number extracted from OCR text
- [ ] If vendor has a saved template: apply field mappings automatically
- [ ] If vendor is new or has no template: flag invoice, prompt accountant for one-time mapping
- [ ] Template stores: `{ canonical_field: ocr_label, bounding_box_hint }` per field
- [ ] Fuzzy matching fallback: RapidFuzz score ≥ 80 on OCR label vs. template label
- [ ] Manual corrections to extracted fields update the template automatically

---

### 5.5 Invoice Dashboard

- [ ] Paginated table (50 rows per page) with sort and filter
- [ ] Filter by: status, vendor, date range, GST %
- [ ] Full-text search across: invoice number, vendor name, GST number
- [ ] Click row → invoice detail view with all extracted fields
- [ ] Inline edit: accountant can correct any extracted field value
- [ ] Status badges: Processed · Processing · Needs review

---

### 5.6 Invoice Detail View

Displays all 5 canonical fields + metadata:

| Field | Type |
|---|---|
| Invoice date | Date (DD MMM YYYY) |
| Invoice number | String |
| Client name | String |
| Amount before GST | Currency (INR, 2dp) |
| Amount after GST | Currency (INR, 2dp) |
| GST % (derived) | Percentage |
| GST amount (derived) | Currency |
| Vendor GST number | String |
| Template used | Boolean |
| OCR confidence | Float |
| Uploaded by | User |
| Uploaded at | Timestamp |
| Last edited by | User |
| Last edited at | Timestamp |

---

### 5.7 Vendor Template Mapping UI

- [ ] Triggered when a new vendor is detected
- [ ] Shows OCR-extracted text labels from the actual invoice
- [ ] Accountant maps each of the 5 canonical fields to the correct OCR label
- [ ] Preview: highlights the matched value on a rendered invoice preview
- [ ] Save template → all future invoices from this vendor auto-extracted
- [ ] Template can be edited by admin at any time

---

### 5.8 Vendor Management

- [ ] Vendor list with: name, GST number, invoice count, template status, last seen date
- [ ] Filter: with template / without template
- [ ] Edit template for any vendor
- [ ] Merge duplicate vendors (admin only)

---

### 5.9 User Management (Admin only)

- [ ] User list with: name, email, role, last login
- [ ] Create user: name, email, role, send invite email
- [ ] Edit role
- [ ] Deactivate user (soft delete — invoices they uploaded are retained)

---

### 5.10 Export

- [ ] Export current filtered view as CSV
- [ ] Export as Excel (.xlsx) with formatting
- [ ] Fields exported: all 5 canonical fields + vendor, date, status, uploaded by
- [ ] Date range picker for export scope

---

## API Specification

Base URL: `https://api.buildco.internal/v1`
Auth: `Authorization: Bearer <jwt>` on all endpoints except `/auth/login`

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Email + password → JWT |
| POST | `/auth/logout` | Invalidate session |
| GET | `/auth/me` | Current user info |

### Invoices

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/invoices` | All | List invoices (paginated, filterable) |
| GET | `/invoices/:id` | All | Invoice detail |
| POST | `/invoices/upload` | Admin, Accountant | Upload PDF, returns job_id |
| GET | `/invoices/job/:job_id` | Admin, Accountant | Poll job status |
| PATCH | `/invoices/:id` | Admin, Accountant | Correct field values |
| DELETE | `/invoices/:id` | Admin | Soft delete |
| GET | `/invoices/export` | All | CSV / XLSX download |

### Vendors

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/vendors` | All | List vendors |
| GET | `/vendors/:id` | All | Vendor detail + template |
| POST | `/vendors/:id/template` | Admin, Accountant | Create/update template |
| DELETE | `/vendors/:id/template` | Admin | Delete template |

### Users (Admin only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users` | List users |
| POST | `/users` | Create user |
| PATCH | `/users/:id` | Edit role / name |
| DELETE | `/users/:id` | Deactivate user |

---

## Data Models

### invoices

```sql
CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    TEXT NOT NULL,
  vendor_id         UUID REFERENCES vendors(id),
  invoice_date      DATE,
  client_name       TEXT,
  amount_before_gst NUMERIC(14,2),
  amount_after_gst  NUMERIC(14,2),
  gst_amount        NUMERIC(14,2) GENERATED ALWAYS AS (amount_after_gst - amount_before_gst) STORED,
  gst_pct           NUMERIC(5,2),
  status            TEXT CHECK (status IN ('queued','processing','processed','needs_review','needs_mapping','error')),
  ocr_confidence    NUMERIC(4,3),
  gst_mismatch      BOOLEAN DEFAULT false,
  pdf_path          TEXT NOT NULL,
  uploaded_by       UUID REFERENCES users(id),
  uploaded_at       TIMESTAMPTZ DEFAULT NOW(),
  last_edited_by    UUID REFERENCES users(id),
  last_edited_at    TIMESTAMPTZ,
  UNIQUE (invoice_number, vendor_id)
);
```

### vendors

```sql
CREATE TABLE vendors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  gst_number    TEXT UNIQUE NOT NULL,
  invoice_count INTEGER DEFAULT 0,
  has_template  BOOLEAN DEFAULT false,
  last_seen     DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### vendor_templates

```sql
CREATE TABLE vendor_templates (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id               UUID REFERENCES vendors(id) UNIQUE,
  invoice_date_label      TEXT,
  invoice_number_label    TEXT,
  client_name_label       TEXT,
  amount_before_gst_label TEXT,
  amount_after_gst_label  TEXT,
  bbox_hints              JSONB,
  created_by              UUID REFERENCES users(id),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

### users

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  role        TEXT CHECK (role IN ('admin','accountant','viewer')),
  is_active   BOOLEAN DEFAULT true,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### audit_log

```sql
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID REFERENCES invoices(id),
  user_id     UUID REFERENCES users(id),
  action      TEXT,
  field       TEXT,
  old_value   TEXT,
  new_value   TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

*Document owner: BuildCo Infra Technology Team*
*Status: APPROVED FOR DEVELOPMENT*
