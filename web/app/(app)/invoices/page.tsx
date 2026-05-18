import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtINR, fmtDate } from "@/lib/format";

const FILTERS: { key: string; label: string }[] = [
  { key: "all",           label: "All" },
  { key: "processed",     label: "Processed" },
  { key: "processing",    label: "Processing" },
  { key: "needs_review",  label: "Review" },
  { key: "needs_mapping", label: "Mapping" },
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "all";
  const q = (sp.q ?? "").trim();

  const where = {
    ...(status !== "all" && { status }),
    ...(q && {
      OR: [
        { invoiceNumber: { contains: q } },
        { vendor: { name: { contains: q } } },
        { vendor: { gstNumber: { contains: q.toUpperCase() } } },
      ],
    }),
  };

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { uploadedAt: "desc" },
    include: { vendor: true },
    take: 100,
  });

  const exportHref = (format: "csv" | "xlsx") => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q) params.set("q", q);
    params.set("format", format);
    return `/api/invoices/export?${params.toString()}`;
  };

  return (
    <div className="fade-in">
      <div className="filter-row">
        {FILTERS.map(({ key, label }) => {
          const params = new URLSearchParams();
          if (key !== "all") params.set("status", key);
          if (q) params.set("q", q);
          const href = `/invoices${params.toString() ? "?" + params.toString() : ""}`;
          return (
            <Link key={key} href={href} className={`filter-btn${status === key ? " active" : ""}`}>
              {label}
            </Link>
          );
        })}
        <div className="filter-right">
          <a href={exportHref("csv")} className="export-btn">Export CSV</a>
          <a href={exportHref("xlsx")} className="export-btn">Export XLSX</a>
        </div>
      </div>

      {q && (
        <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12, letterSpacing: "0.06em" }}>
          {invoices.length} result{invoices.length === 1 ? "" : "s"} for "<span style={{ color: "var(--white)" }}>{q}</span>"
          <Link href={`/invoices${status !== "all" ? "?status=" + status : ""}`} style={{ color: "var(--amber)", marginLeft: 12, textDecoration: "none" }}>
            clear
          </Link>
        </div>
      )}

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th>Invoice no.</th>
              <th>Vendor</th>
              <th>Date</th>
              <th>Before GST</th>
              <th>After GST</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => (
              <tr key={inv.id} style={{ cursor: "default" }}>
                <td className="td-mono td-muted">{String(i + 1).padStart(2, "0")}</td>
                <td className="td-mono td-amber">
                  <Link href={`/invoices/${inv.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {inv.invoiceNumber}
                  </Link>
                </td>
                <td className="td-white" style={{ fontSize: 12 }}>{inv.vendor?.name ?? "—"}</td>
                <td className="td-mono td-muted">{fmtDate(inv.invoiceDate)}</td>
                <td className="td-mono td-muted">{fmtINR(inv.amountBeforeGst)}</td>
                <td className="td-mono td-white">{fmtINR(inv.amountAfterGst)}</td>
                <td><StatusBadge status={inv.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
            No invoices found
          </div>
        )}
      </div>
    </div>
  );
}
