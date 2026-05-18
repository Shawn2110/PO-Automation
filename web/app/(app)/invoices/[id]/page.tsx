import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { Icon } from "@/components/Icons";
import { fmtINR, fmtDate, fmtDateTime } from "@/lib/format";
import { InvoiceFieldEditor } from "@/components/InvoiceFieldEditor";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const canEdit = session?.user.role === "admin" || session?.user.role === "accountant";

  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      vendor: true,
      uploadedBy: { select: { name: true, email: true } },
      lastEditedBy: { select: { name: true, email: true } },
      auditEntries: { orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { name: true } } } },
    },
  });

  if (!inv) notFound();

  const gstAmt = inv.amountAfterGst != null && inv.amountBeforeGst != null
    ? inv.amountAfterGst - inv.amountBeforeGst : null;
  const lowConf = (inv.ocrConfidence ?? 1) < 0.7;

  return (
    <div className="fade-in">
      <Link href="/invoices" className="detail-back">
        <Icon name="arrow_l" size={12} /> Back
      </Link>

      <div className="detail-card">
        <div className="detail-head">
          <div>
            <div className="detail-num">{inv.invoiceNumber}</div>
            <div className="detail-vendor">
              {inv.vendor?.name ?? "Unknown vendor"}
              {inv.vendor?.gstNumber && (
                <span className="mono" style={{ color: "var(--muted)", marginLeft: 8, fontSize: 10 }}>
                  · {inv.vendor.gstNumber}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={inv.status} />
        </div>

        <div className="detail-body">
          <div className="field-grid">
            <InvoiceFieldEditor
              invoiceId={inv.id}
              field="invoiceDate"
              label="Invoice date"
              type="date"
              initialValue={inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : ""}
              canEdit={canEdit}
              lowConfidence={lowConf}
            />
            <InvoiceFieldEditor
              invoiceId={inv.id}
              field="invoiceNumber"
              label="Invoice number"
              initialValue={inv.invoiceNumber}
              canEdit={canEdit}
            />
            <InvoiceFieldEditor
              invoiceId={inv.id}
              field="clientName"
              label="Client name"
              initialValue={inv.clientName ?? ""}
              canEdit={canEdit}
              lowConfidence={lowConf}
            />
            <div className="field-cell">
              <div className="field-label">Vendor GST</div>
              <div className="field-val">{inv.vendor?.gstNumber ?? "—"}</div>
            </div>
          </div>

          <div>
            <div className="mono" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
              Extracted amounts {canEdit && <span style={{ color: "var(--muted)" }}>· click to edit</span>}
            </div>

            <div className="field-grid" style={{ marginBottom: 16 }}>
              <InvoiceFieldEditor
                invoiceId={inv.id}
                field="amountBeforeGst"
                label="Before GST"
                type="number"
                initialValue={inv.amountBeforeGst != null ? String(inv.amountBeforeGst) : ""}
                canEdit={canEdit}
                lowConfidence={lowConf}
              />
              <InvoiceFieldEditor
                invoiceId={inv.id}
                field="amountAfterGst"
                label="After GST"
                type="number"
                initialValue={inv.amountAfterGst != null ? String(inv.amountAfterGst) : ""}
                canEdit={canEdit}
                lowConfidence={lowConf}
              />
            </div>

            <div className="amt-row">
              <span className="amt-label">GST ({inv.gstPct ?? "—"}%)</span>
              <span className="amt-val">{fmtINR(gstAmt)}</span>
            </div>
            <div className="amt-row" style={{ borderTop: "1px solid var(--border)", borderBottom: "none", paddingTop: 14 }}>
              <span className="amt-label" style={{ color: "var(--white)", fontWeight: 500 }}>Grand total</span>
              <span className="amt-val" style={{ color: "var(--amber)", fontSize: 15, fontWeight: 500 }}>
                {fmtINR(inv.amountAfterGst)}
              </span>
            </div>

            {inv.gstMismatch && (
              <div className="mono" style={{ marginTop: 16, padding: 10, border: "1px solid var(--red)", color: "var(--red)", fontSize: 10, letterSpacing: "0.06em" }}>
                GST MATHS MISMATCH · derived rate ≠ declared rate
              </div>
            )}
          </div>

          <div className="mono" style={{ marginTop: 24, fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", lineHeight: 1.8 }}>
            UPLOADED · {fmtDateTime(inv.uploadedAt)} · BY {inv.uploadedBy?.name ?? "—"}<br />
            {inv.lastEditedAt && <>EDITED · {fmtDateTime(inv.lastEditedAt)} · BY {inv.lastEditedBy?.name ?? "—"}<br /></>}
            OCR CONFIDENCE · {(inv.ocrConfidence ?? 0).toFixed(2)}
          </div>
        </div>
      </div>

      {inv.auditEntries.length > 0 && (
        <div style={{ marginTop: 32, maxWidth: 580 }}>
          <div className="section-head">
            <span className="section-title">Audit log</span>
            <div className="section-rule" />
            <span className="section-count">{inv.auditEntries.length} entries</span>
          </div>
          <div style={{ border: "1px solid var(--border)" }}>
            {inv.auditEntries.map((a) => (
              <div key={a.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
                <span style={{ color: "var(--white)" }}>{a.action}</span>
                {a.field && <> · {a.field}: <span style={{ color: "var(--muted)" }}>{a.oldValue ?? "—"}</span> → <span style={{ color: "var(--amber)" }}>{a.newValue ?? "—"}</span></>}
                <span style={{ float: "right" }}>{fmtDateTime(a.createdAt)} · {a.user?.name ?? "system"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
