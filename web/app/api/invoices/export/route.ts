import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const format = (sp.get("format") ?? "csv").toLowerCase();
  const status = sp.get("status");
  const q = (sp.get("q") ?? "").trim();
  const from = sp.get("from");
  const to = sp.get("to");

  const where = {
    ...(status && status !== "all" && { status }),
    ...(q && {
      OR: [
        { invoiceNumber: { contains: q } },
        { vendor: { name: { contains: q } } },
      ],
    }),
    ...((from || to) && {
      invoiceDate: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      },
    }),
  };

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { uploadedAt: "desc" },
    include: { vendor: true, uploadedBy: { select: { name: true } } },
  });

  const rows = invoices.map((i) => ({
    "Invoice Number":   i.invoiceNumber,
    "Vendor":           i.vendor?.name ?? "",
    "GST Number":       i.vendor?.gstNumber ?? "",
    "Invoice Date":     fmtDate(i.invoiceDate),
    "Client Name":      i.clientName ?? "",
    "Amount Before GST": i.amountBeforeGst ?? "",
    "Amount After GST":  i.amountAfterGst ?? "",
    "GST %":            i.gstPct ?? "",
    "Status":           i.status,
    "Uploaded By":      i.uploadedBy?.name ?? "",
    "Uploaded At":      i.uploadedAt.toISOString(),
  }));

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="invoices-${Date.now()}.xlsx"`,
      },
    });
  }

  // CSV
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape((r as Record<string, unknown>)[h])).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${Date.now()}.csv"`,
    },
  });
}
