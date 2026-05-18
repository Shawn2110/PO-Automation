import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtINR, fmtDate } from "@/lib/format";

export default async function DashboardPage() {
  const [total, processed, needsReview, needsMapping, recent, sumRow] = await Promise.all([
    prisma.invoice.count(),
    prisma.invoice.count({ where: { status: "processed" } }),
    prisma.invoice.count({ where: { status: "needs_review" } }),
    prisma.invoice.count({ where: { status: "needs_mapping" } }),
    prisma.invoice.findMany({
      orderBy: { uploadedAt: "desc" },
      take: 5,
      include: { vendor: true },
    }),
    prisma.invoice.aggregate({ _sum: { amountAfterGst: true } }),
  ]);

  const totalValue = sumRow._sum.amountAfterGst ?? 0;
  const autoRate = total ? Math.round((processed / total) * 100) : 0;

  const stats: { label: string; value: string; sub: string; color: string }[] = [
    { label: "Total invoices", value: String(total),               sub: "All time",                       color: "var(--white)" },
    { label: "Processed",      value: String(processed),           sub: `${autoRate}% auto-extracted`,    color: "var(--green)" },
    { label: "Needs review",   value: String(needsReview),         sub: "Pending corrections",            color: "var(--red)" },
    { label: "Total value",    value: fmtINR(totalValue),          sub: "Incl. GST",                       color: "var(--amber)" },
  ];

  return (
    <div className="fade-in">
      <div className="stat-row">
        {stats.map((s) => (
          <div key={s.label} className="stat-cell">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {needsMapping > 0 && (
        <div style={{ border: "1px solid var(--border)", padding: "12px 16px", marginBottom: 28, maxWidth: 720, background: "var(--off)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--white)" }}>
                {needsMapping} invoice{needsMapping > 1 ? "s" : ""} waiting for template mapping
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                New vendors detected. Map their fields once to unlock auto-extraction.
              </div>
            </div>
            <Link href="/vendors" className="btn-amber" style={{ padding: "8px 16px", flex: "none" }}>
              Map templates →
            </Link>
          </div>
        </div>
      )}

      <div className="section-head">
        <span className="section-title">Recent invoices</span>
        <div className="section-rule" />
        <Link href="/invoices" style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          View all →
        </Link>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice no.</th>
              <th>Vendor</th>
              <th>Date</th>
              <th>After GST</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((inv) => (
              <tr key={inv.id}>
                <td className="td-mono td-amber">
                  <Link href={`/invoices/${inv.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {inv.invoiceNumber}
                  </Link>
                </td>
                <td className="td-white" style={{ fontSize: 12 }}>{inv.vendor?.name ?? "—"}</td>
                <td className="td-mono td-muted">{fmtDate(inv.invoiceDate)}</td>
                <td className="td-mono td-white">{fmtINR(inv.amountAfterGst)}</td>
                <td><StatusBadge status={inv.status} /></td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                  No invoices yet. <Link href="/upload" style={{ color: "var(--amber)" }}>Upload one →</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
