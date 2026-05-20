import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

async function lastErrorMessage(invoiceId: string): Promise<string> {
  const audit = await prisma.auditLog.findFirst({
    where: { invoiceId, action: { in: ["error", "duplicate"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!audit?.metadata) return "Processing failed — see audit log";
  try {
    const meta = JSON.parse(audit.metadata) as { message?: string };
    return meta.message ?? "Processing failed — see audit log";
  } catch {
    return "Processing failed — see audit log";
  }
}

// Maps status → stage index (0..4) the UI uses to drive its progress animation.
const STAGE: Record<string, number> = {
  queued: 0,
  processing: 2, // optimistically show "Running PaddleOCR"
  processed: 5,
  needs_review: 5,
  needs_mapping: 4,
  error: 5,
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { vendor: true },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    invoiceId: inv.id,
    status: inv.status,
    stage: STAGE[inv.status] ?? 0,
    vendorName: inv.vendor?.name ?? null,
    vendorId: inv.vendorId,
    fields: {
      invoiceNumber: inv.invoiceNumber?.startsWith("PENDING-") ? null : inv.invoiceNumber,
      invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null,
      clientName: inv.clientName,
      amountBeforeGst: inv.amountBeforeGst,
      amountAfterGst: inv.amountAfterGst,
    },
    error: inv.status === "error" ? await lastErrorMessage(id) : undefined,
  });
}
