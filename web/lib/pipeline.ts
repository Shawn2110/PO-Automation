// Pipeline orchestrator — single-stage Qwen2.5-VL extraction via Modal.
// Replaces the Tesseract-OCR + template-matching multi-stage pipeline (now in
// ../archive/ocr-service/ + web/lib/extraction/).

import { promises as fs } from "fs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runVlmExtract } from "@/lib/ocr";

export type PipelineResult = {
  invoiceId: string;
  status: "processed" | "needs_review" | "error";
  error?: string;
};

export async function runPipeline(invoiceId: string): Promise<PipelineResult> {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return { invoiceId, status: "error", error: "Invoice not found" };

  try {
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "processing" } });

    // ── VLM extraction ────────────────────────────────────────
    const pdfBuffer = await fs.readFile(inv.pdfPath);
    const result = await runVlmExtract(pdfBuffer);

    // ── Vendor upsert by GST number ───────────────────────────
    const vendor = result.gstNumber
      ? await prisma.vendor.upsert({
          where: { gstNumber: result.gstNumber },
          update: {
            lastSeen: new Date(),
            invoiceCount: { increment: 1 },
            // If the vendor was previously seeded with a placeholder name and the
            // VLM now has a real one, fill it in. Don't overwrite an existing name.
            ...(result.vendorName ? { name: result.vendorName } : {}),
          },
          create: {
            name: result.vendorName ?? "Unknown Vendor",
            gstNumber: result.gstNumber,
            hasTemplate: false,
            lastSeen: new Date(),
            invoiceCount: 1,
          },
        })
      : null;

    const status: "processed" | "needs_review" = result.confidence < 0.7 ? "needs_review" : "processed";

    try {
      await prisma.$transaction([
        prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            invoiceNumber:   result.invoiceNumber ?? inv.invoiceNumber,
            invoiceDate:     result.invoiceDate ? new Date(result.invoiceDate) : null,
            // Buyer name isn't on most GST invoices in a stable position — the VLM
            // doesn't extract it. Static for the BuildCo demo.
            clientName:      "BuildCo Infra Pvt Ltd",
            amountBeforeGst: result.amountBeforeGst,
            amountAfterGst:  result.amountAfterGst,
            gstPct:          result.gstPct,
            gstMismatch:     false,
            status,
            ocrConfidence:   result.confidence,
            vendorId:        vendor?.id ?? null,
          },
        }),
        prisma.auditLog.create({
          data: {
            invoiceId,
            action: "extracted",
            metadata: JSON.stringify({
              engine: result.engine,
              confidence: result.confidence,
              durationMs: result.durationMs,
              vendorId: vendor?.id ?? null,
              fieldsFilled: {
                invoiceNumber:   !!result.invoiceNumber,
                invoiceDate:     !!result.invoiceDate,
                vendorName:      !!result.vendorName,
                gstNumber:       !!result.gstNumber,
                amountBeforeGst: result.amountBeforeGst != null,
                amountAfterGst:  result.amountAfterGst != null,
              },
            }),
          },
        }),
      ]);

      return { invoiceId, status };
    } catch (e) {
      // PRD §5.2 — duplicate detection. Surface a useful message instead of the
      // raw "Unique constraint failed on (invoiceNumber, vendorId)" Prisma error.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && vendor) {
        const original = result.invoiceNumber
          ? await prisma.invoice.findFirst({
              where: {
                invoiceNumber: result.invoiceNumber,
                vendorId: vendor.id,
                NOT: { id: invoiceId },
              },
              include: { uploadedBy: { select: { name: true } } },
            })
          : null;

        const friendly = original
          ? `Already uploaded — invoice ${original.invoiceNumber} from ${vendor.name} was processed on ${original.uploadedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} by ${original.uploadedBy?.name ?? "another user"}.`
          : `Duplicate invoice — same number already exists for ${vendor.name}.`;

        await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "error" } });
        await prisma.auditLog.create({
          data: {
            invoiceId,
            action: "duplicate",
            metadata: JSON.stringify({ message: friendly, duplicateOfId: original?.id ?? null, vendorId: vendor.id }),
          },
        });
        return { invoiceId, status: "error", error: friendly };
      }
      throw e;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "error" },
    }).catch(() => {});
    await prisma.auditLog.create({
      data: { invoiceId, action: "error", metadata: JSON.stringify({ message }) },
    }).catch(() => {});
    return { invoiceId, status: "error", error: message };
  }
}
