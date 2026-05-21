import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtINR, fmtDate } from "@/lib/format";

const PENDING_STATUSES = ["queued", "processing", "needs_review"] as const;

export default async function DashboardPage() {
  const [total, completed, pendingCount, oldestPending, recent, revenueRow] = await Promise.all([
    prisma.invoice.count(),
    prisma.invoice.count({ where: { status: "processed" } }),
    prisma.invoice.count({ where: { status: { in: [...PENDING_STATUSES] } } }),
    prisma.invoice.findFirst({
      where: { status: { in: [...PENDING_STATUSES] } },
      orderBy: { uploadedAt: "asc" },
      select: { uploadedAt: true },
    }),
    prisma.invoice.findMany({
      orderBy: { uploadedAt: "desc" },
      take: 5,
      include: { vendor: true },
    }),
    prisma.invoice.aggregate({
      _sum: { amountAfterGst: true },
      where: { status: "processed" },
    }),
  ]);

  const totalRevenue = revenueRow._sum.amountAfterGst ?? 0;
  const pendingSince = oldestPending ? fmtDate(oldestPending.uploadedAt) : null;

  const stats: { label: string; value: string; sub: string; color: string }[] = [
    { label: "Total POs",       value: String(total),               sub: "All uploaded purchase orders",                  color: "var(--white)" },
    { label: "Pending",         value: String(pendingCount),
      sub: pendingCount > 0 && pendingSince ? `Since ${pendingSince}` : "All clear",
      color: pendingCount > 0 ? "var(--red)" : "var(--green)" },
    { label: "Completed",       value: String(completed),           sub: total ? `${Math.round((completed / total) * 100)}% of total` : "—", color: "var(--green)" },
    { label: "Total revenue",   value: fmtINR(totalRevenue),        sub: "Sum of completed POs (incl. GST)",              color: "var(--amber)" },
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

      <div className="section-head">
        <span className="section-title">Recent POs</span>
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
                  No POs yet. <Link href="/upload" style={{ color: "var(--amber)" }}>Upload one →</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
