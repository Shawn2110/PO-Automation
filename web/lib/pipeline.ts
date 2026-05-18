// Pipeline orchestrator — mirrors stages 3..6 from docs/agent.md.
// In the demo this runs in-process. In production, this body moves to a Celery worker.

import { prisma } from "@/lib/db";
import { runOcr } from "@/lib/ocr";
import { runExtraction, pickVendorNameCandidate } from "@/lib/extraction/extract";
import { GST_PATTERN } from "@/lib/extraction/types";
import type { Block } from "@/lib/extraction/types";

export type PipelineResult = {
  invoiceId: string;
  status: "processed" | "needs_review" | "needs_mapping" | "error";
  error?: string;
};

export async function runPipeline(invoiceId: string): Promise<PipelineResult> {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return { invoiceId, status: "error", error: "Invoice not found" };

  try {
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "processing" } });

    // ── Stage 2: OCR ──────────────────────────────────────────
    const ocr = await runOcr(inv.pdfPath);
    const blocks: Block[] = ocr.blocks;

    if (ocr.overallConfidence < 0.5) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "error",
          ocrConfidence: ocr.overallConfidence,
          ocrBlocks: JSON.stringify(blocks),
        },
      });
      await prisma.auditLog.create({
        data: { invoiceId, action: "ocr_low_confidence", metadata: JSON.stringify({ overall: ocr.overallConfidence }) },
      });
      return { invoiceId, status: "error", error: "OCR confidence too low" };
    }

    // ── Stage 3: Vendor detection ─────────────────────────────
    const fullText = blocks.map((b) => b.text).join(" ").toUpperCase();
    const gstMatch = fullText.match(GST_PATTERN);
    let vendor = null as Awaited<ReturnType<typeof prisma.vendor.findUnique>>;
    if (gstMatch) {
      vendor = await prisma.vendor.findUnique({
        where: { gstNumber: gstMatch[0] },
        include: { template: true },
      });
      if (!vendor) {
        const candidateName = pickVendorNameCandidate(blocks) ?? "Unknown Vendor";
        vendor = await prisma.vendor.create({
          data: { name: candidateName, gstNumber: gstMatch[0], hasTemplate: false, lastSeen: new Date() },
          include: { template: true },
        });
      }
    }

    // ── Stage 4: Template matching ────────────────────────────
    if (!vendor || !vendor.template || !vendor.hasTemplate) {
      // Persist OCR blocks so the template-mapping UI has labels to pick from.
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "needs_mapping",
          vendorId: vendor?.id ?? null,
          ocrConfidence: ocr.overallConfidence,
          ocrBlocks: JSON.stringify(blocks),
        },
      });
      await prisma.auditLog.create({
        data: {
          invoiceId,
          action: "needs_mapping",
          metadata: JSON.stringify({ vendorId: vendor?.id, gstFound: !!gstMatch, engine: ocr.engine }),
        },
      });
      return { invoiceId, status: "needs_mapping" };
    }

    const extraction = runExtraction(blocks, {
      invoiceDate:     vendor.template.invoiceDateLabel,
      invoiceNumber:   vendor.template.invoiceNumberLabel,
      clientName:      vendor.template.clientNameLabel,
      amountBeforeGst: vendor.template.amountBeforeGstLabel,
      amountAfterGst:  vendor.template.amountAfterGstLabel,
    });

    // ── Stage 5 + 6: Validate + persist ───────────────────────
    const status = extraction.needsReview ? "needs_review" : "processed";

    await prisma.$transaction([
      prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          invoiceNumber: extraction.invoiceNumber.value ?? inv.invoiceNumber,
          invoiceDate:   extraction.invoiceDate.value,
          clientName:    extraction.clientName.value,
          amountBeforeGst: extraction.amountBeforeGst.value,
          amountAfterGst:  extraction.amountAfterGst.value,
          gstPct:          extraction.gstPct,
          gstMismatch:     extraction.gstMismatch,
          status,
          ocrConfidence:   ocr.overallConfidence,
          vendorId:        vendor.id,
          ocrBlocks:       JSON.stringify(blocks),
        },
      }),
      prisma.vendor.update({
        where: { id: vendor.id },
        data: { invoiceCount: { increment: 1 }, lastSeen: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          invoiceId,
          action: "extracted",
          metadata: JSON.stringify({
            engine: ocr.engine,
            ocrConfidence: ocr.overallConfidence,
            fieldConfidences: {
              invoiceDate:     extraction.invoiceDate.confidence,
              invoiceNumber:   extraction.invoiceNumber.confidence,
              clientName:      extraction.clientName.confidence,
              amountBeforeGst: extraction.amountBeforeGst.confidence,
              amountAfterGst:  extraction.amountAfterGst.confidence,
            },
            gstMismatch: extraction.gstMismatch,
            vendorId: vendor.id,
            templateId: vendor.template.id,
          }),
        },
      }),
    ]);

    return { invoiceId, status };
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
