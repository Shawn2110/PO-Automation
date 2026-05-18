import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";

export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({
    orderBy: [{ hasTemplate: "asc" }, { name: "asc" }],
    include: { _count: { select: { invoices: true } } },
  });

  const mapped = vendors.filter((v) => v.hasTemplate).length;

  return (
    <div className="fade-in">
      <div className="section-head" style={{ marginBottom: 12 }}>
        <span className="section-title">All vendors</span>
        <div className="section-rule" />
        <span className="section-count">{mapped} / {vendors.length} with templates</span>
      </div>

      <div className="vendor-list">
        {vendors.map((v) => (
          <div key={v.id} className="vendor-row">
            <div style={{ flex: 1 }}>
              <div className="vendor-name">{v.name}</div>
              <div className="vendor-gst">{v.gstNumber}</div>
            </div>
            <div className="vendor-count">{v._count.invoices}</div>
            <div className="mono" style={{ fontSize: 9, color: "var(--muted)", width: 110, textAlign: "right" }}>
              {v.lastSeen ? fmtDate(v.lastSeen) : "—"}
            </div>
            {v.hasTemplate ? (
              <>
                <span className="mono" style={{ fontSize: 9, color: "var(--green)", letterSpacing: "0.1em", width: 60, textAlign: "center" }}>MAPPED</span>
                <Link href={`/vendors/${v.id}/template`} className="export-btn" style={{ padding: "4px 12px" }}>
                  Edit
                </Link>
              </>
            ) : (
              <Link href={`/vendors/${v.id}/template`} className="btn-amber" style={{ padding: "4px 14px", flex: "none" }}>
                MAP →
              </Link>
            )}
          </div>
        ))}
        {vendors.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
            No vendors yet
          </div>
        )}
      </div>
    </div>
  );
}
