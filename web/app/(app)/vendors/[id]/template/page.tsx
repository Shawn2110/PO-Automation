import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Icon } from "@/components/Icons";
import { TemplateMapper } from "@/components/TemplateMapper";

export default async function VendorTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invoice?: string }>;
}) {
  const { id } = await params;
  const { invoice: invoiceId } = await searchParams;

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: { template: true },
  });
  if (!vendor) notFound();

  // If there's a pending invoice with OCR blocks, surface its labels as dropdown options.
  let ocrLabels: string[] = [];
  if (invoiceId) {
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (inv?.ocrBlocks) {
      try {
        const blocks = JSON.parse(inv.ocrBlocks) as { text: string }[];
        const seen = new Set<string>();
        for (const b of blocks) {
          const t = b.text.trim();
          if (t && t.length <= 40 && !seen.has(t)) {
            seen.add(t);
            ocrLabels.push(t);
          }
        }
      } catch { /* ignore */ }
    }
  }

  // If still no labels, also fall back to any other needs_mapping invoice from this vendor.
  if (ocrLabels.length === 0) {
    const fallback = await prisma.invoice.findFirst({
      where: { vendorId: vendor.id, ocrBlocks: { not: null } },
      orderBy: { uploadedAt: "desc" },
    });
    if (fallback?.ocrBlocks) {
      try {
        const blocks = JSON.parse(fallback.ocrBlocks) as { text: string }[];
        const seen = new Set<string>();
        for (const b of blocks) {
          const t = b.text.trim();
          if (t && t.length <= 40 && !seen.has(t)) {
            seen.add(t);
            ocrLabels.push(t);
          }
        }
      } catch { /* ignore */ }
    }
  }

  return (
    <div className="fade-in">
      <Link href="/vendors" className="detail-back">
        <Icon name="arrow_l" size={12} /> Back to vendors
      </Link>

      <TemplateMapper
        vendorId={vendor.id}
        vendorName={vendor.name}
        ocrLabels={ocrLabels}
        existing={{
          invoiceDateLabel:     vendor.template?.invoiceDateLabel ?? "",
          invoiceNumberLabel:   vendor.template?.invoiceNumberLabel ?? "",
          clientNameLabel:      vendor.template?.clientNameLabel ?? "",
          amountBeforeGstLabel: vendor.template?.amountBeforeGstLabel ?? "",
          amountAfterGstLabel:  vendor.template?.amountAfterGstLabel ?? "",
        }}
        invoiceId={invoiceId}
      />
    </div>
  );
}
