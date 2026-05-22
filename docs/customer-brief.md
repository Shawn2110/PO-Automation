# PO Automation — Customer Brief
`BuildCo Infra Pvt. Ltd. · May 2026`

---

## In one paragraph

We've built BuildCo Infra an internal tool that takes the manual data entry out of vendor invoice processing. Your accountants drop the PDF into a browser, the system reads it automatically and fills in the six fields you care about (invoice number, date, vendor, GST, taxable value, total), and the invoice lands in a reviewable list with a full audit trail. New vendors are handled the same way as known ones — no onboarding step, no template to set up. Read-only viewers get a dashboard that shows total purchase orders, what's pending and since when, what's completed, and total revenue at a glance.

---

## The problem we solved

Your accountants were typing the same six fields out of every PDF invoice into a spreadsheet. With a few dozen vendors and a few hundred invoices a month, that's hours of repetitive work each week — and every typo becomes an audit headache later.

The first version we attempted (Phase 1) used traditional optical character recognition with per-vendor templates. It worked, but every new vendor required a one-time setup step where an accountant had to point at the right text labels on a sample invoice. We replaced that approach with an AI model that reads the invoice the way a person does — looking at the image and identifying the fields directly. New vendors now work on the first upload.

---

## How your team uses it

**Accountants:**

1. Open the tool, sign in.
2. Drag a vendor's PDF onto the upload page.
3. Watch the row appear in the invoices list — the six fields are filled in automatically in about ten seconds.
4. Click the row to review. Edit any field inline if the AI got something wrong. Every edit is logged with who, what, and when.
5. Export the filtered list to CSV or Excel whenever you need to.

**Viewers (e.g. management, audit):**

1. Sign in with the read-only account.
2. Land on the dashboard:
   - **Total POs** — count of purchase orders in the system
   - **Pending** — anything still being processed or awaiting accountant review, with the date the oldest one came in ("since 12 Apr")
   - **Completed** — count of fully processed POs and their share of the total
   - **Total revenue** — sum of completed POs, GST inclusive
3. Browse the invoices list, click into any row to see the full extracted detail and audit history.

---

## What you get today

- **Drag-and-drop upload** with safety checks (file type, 20MB limit)
- **Automatic field extraction** — invoice number, date, vendor name, GSTIN, taxable value, total
- **Vendor list maintained automatically** — every new GSTIN creates a vendor record on its own
- **Duplicate detection** — the system refuses to re-upload an invoice from the same vendor and shows you when the original was processed and by whom
- **Inline review and correction** with a per-field audit trail
- **Dashboard** built around the four metrics above
- **CSV and Excel export** of any filtered view (date range, status)
- **Role-based access** — accountant (read/write) and viewer (read-only)
- **Light and dark mode** — follows the user's system setting

---

## What it costs to run

The system is hosted on three providers' free tiers:

| Component | Provider | Free tier | When that runs out |
|---|---|---|---|
| Web app | Render | Free web service | Always free; goes to sleep after 15 min of inactivity (~30s wake-up on next visit) |
| Database | Supabase | 500 MB free | At your scale, never. Database pauses after 7 days of zero use; unpauses on the next request. |
| AI invoice reader | Modal | $30/month in GPU credits, renewable | Your estimated peak (200 invoices/month) costs about ₹40 of the ₹2,500 credit, so it never runs out either. |

**Realistic total monthly cost at full demo usage: ₹0.** If usage grows beyond ~5,000 invoices a month we'd revisit the plans — but that's a happy problem.

---

## What we deliberately left out (for now)

These are not bugs; they're scoped out of v1 because they don't change the daily experience:

- **Multi-page PDF support.** The AI reads page 1 only. Most GST invoices are single-page; the few that aren't can be split before upload.
- **Live notifications.** The UI updates by polling every 800ms — fast enough to feel live, simpler than running a websocket server.
- **A separate admin role.** We collapsed admin into "accountant" because the demo only needed two real-world roles. We can re-add an admin tier if you want one (user management, role re-assignment).
- **Email password resets.** Currently passwords are set by us; we can wire up email-based reset whenever your IT team is ready.

---

## Where we go next

We're shipping in phases so you can see and shape the work as it lands. Roughly:

- **Now → June:** Production usage with your accounting team. We'll watch where the AI gets fields wrong, tune the prompt, and add small workflow improvements based on what they actually need.
- **July → August:** Migrate the PDF storage to S3 (or a private equivalent) so files survive across deploys. Multi-page support.
- **Beyond:** Once we have around 500 manually-corrected invoices, we can train a smaller, cheaper, more accurate model that's tailored to BuildCo's vendor mix specifically. The current AI is a great starting point but a custom one will be better and cheaper.

---

## What we need from you

1. **A name for the production environment** — currently the demo is at `po-automation-i7xr.onrender.com`. We'd move it to something like `po.buildcoinfra.in` once you confirm a subdomain.
2. **A list of real users** with role assignments — names, emails, and whether they're accountant or viewer.
3. **About 20 real invoices** across a variety of your top vendors so we can sanity-check the AI's accuracy on your actual document formats before the team starts depending on it daily.

---

*Questions, changes, or things that feel wrong — write back and we'll discuss. This brief is meant as a starting point for a conversation, not a final spec.*
