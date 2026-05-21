import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { deriveGstPct, snapToStandardRate, isGstMismatch } from "@/lib/extraction/parse";

const patchSchema = z.object({
  invoiceNumber:   z.string().min(1).optional(),
  invoiceDate:     z.string().optional(),
  clientName:      z.string().optional(),
  amountBeforeGst: z.union([z.string(), z.number()]).optional(),
  amountAfterGst:  z.union([z.string(), z.number()]).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { vendor: true, uploadedBy: { select: { name: true, email: true } } },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(inv);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "accountant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  const auditEntries: { field: string; oldValue: string | null; newValue: string | null }[] = [];

  if (parsed.data.invoiceNumber !== undefined && parsed.data.invoiceNumber !== inv.invoiceNumber) {
    patch.invoiceNumber = parsed.data.invoiceNumber;
    auditEntries.push({ field: "invoiceNumber", oldValue: inv.invoiceNumber, newValue: parsed.data.invoiceNumber });
  }
  if (parsed.data.invoiceDate !== undefined) {
    const newDate = parsed.data.invoiceDate ? new Date(parsed.data.invoiceDate) : null;
    const oldIso = inv.invoiceDate ? inv.invoiceDate.toISOString().slice(0, 10) : null;
    const newIso = newDate ? newDate.toISOString().slice(0, 10) : null;
    if (oldIso !== newIso) {
      patch.invoiceDate = newDate;
      auditEntries.push({ field: "invoiceDate", oldValue: oldIso, newValue: newIso });
    }
  }
  if (parsed.data.clientName !== undefined && parsed.data.clientName !== (inv.clientName ?? "")) {
    patch.clientName = parsed.data.clientName || null;
    auditEntries.push({ field: "clientName", oldValue: inv.clientName, newValue: parsed.data.clientName || null });
  }

  let nextBefore = inv.amountBeforeGst;
  let nextAfter  = inv.amountAfterGst;
  if (parsed.data.amountBeforeGst !== undefined) {
    const n = Number(parsed.data.amountBeforeGst);
    if (Number.isFinite(n)) {
      if (n !== inv.amountBeforeGst) {
        patch.amountBeforeGst = n;
        auditEntries.push({ field: "amountBeforeGst", oldValue: String(inv.amountBeforeGst ?? "—"), newValue: String(n) });
        nextBefore = n;
      }
    }
  }
  if (parsed.data.amountAfterGst !== undefined) {
    const n = Number(parsed.data.amountAfterGst);
    if (Number.isFinite(n)) {
      if (n !== inv.amountAfterGst) {
        patch.amountAfterGst = n;
        auditEntries.push({ field: "amountAfterGst", oldValue: String(inv.amountAfterGst ?? "—"), newValue: String(n) });
        nextAfter = n;
      }
    }
  }

  // Re-derive GST if either amount changed.
  if (("amountBeforeGst" in patch || "amountAfterGst" in patch) && nextBefore != null && nextAfter != null && nextBefore > 0) {
    const derived = deriveGstPct(nextBefore, nextAfter);
    const snapped = snapToStandardRate(derived);
    patch.gstPct = snapped;
    patch.gstMismatch = isGstMismatch(derived, snapped, 0.5);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  patch.lastEditedById = session.user.id;
  patch.lastEditedAt   = new Date();

  // If invoice was flagged needs_review and all amounts are now sensible, allow promotion to processed.
  if (inv.status === "needs_review" && nextBefore != null && nextAfter != null && nextBefore > 0) {
    patch.status = "processed";
  }

  await prisma.$transaction([
    prisma.invoice.update({ where: { id }, data: patch }),
    ...auditEntries.map((e) =>
      prisma.auditLog.create({
        data: {
          invoiceId: id,
          userId: session.user.id,
          action: "corrected",
          field: e.field,
          oldValue: e.oldValue,
          newValue: e.newValue,
        },
      }),
    ),
  ]);

  return NextResponse.json({ ok: true, changed: auditEntries.map((e) => e.field) });
}
