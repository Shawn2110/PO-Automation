import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";

const bodySchema = z.object({
  invoiceDateLabel:     z.string().optional(),
  invoiceNumberLabel:   z.string().optional(),
  clientNameLabel:      z.string().optional(),
  amountBeforeGstLabel: z.string().optional(),
  amountAfterGstLabel:  z.string().optional(),
  retryInvoiceId:       z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin" && session.user.role !== "accountant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: vendorId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const labels = {
    invoiceDateLabel:     parsed.data.invoiceDateLabel     ?? null,
    invoiceNumberLabel:   parsed.data.invoiceNumberLabel   ?? null,
    clientNameLabel:      parsed.data.clientNameLabel      ?? null,
    amountBeforeGstLabel: parsed.data.amountBeforeGstLabel ?? null,
    amountAfterGstLabel:  parsed.data.amountAfterGstLabel  ?? null,
  };

  await prisma.$transaction([
    prisma.vendorTemplate.upsert({
      where: { vendorId },
      create: {
        vendorId,
        ...labels,
        createdById: session.user.id,
      },
      update: {
        ...labels,
        createdById: session.user.id,
      },
    }),
    prisma.vendor.update({ where: { id: vendorId }, data: { hasTemplate: true } }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "template_saved",
        metadata: JSON.stringify({ vendorId, labels }),
      },
    }),
  ]);

  // Re-run extraction on the invoice that prompted mapping (if any).
  if (parsed.data.retryInvoiceId) {
    const inv = await prisma.invoice.findUnique({ where: { id: parsed.data.retryInvoiceId } });
    if (inv && inv.vendorId === vendorId) {
      // Run synchronously so the user sees the result on the next page load.
      await runPipeline(parsed.data.retryInvoiceId);
    }
  }

  return NextResponse.json({ ok: true });
}
