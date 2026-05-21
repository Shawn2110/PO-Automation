import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { saveUploadedPdf } from "@/lib/storage";
import { runPipeline } from "@/lib/pipeline";

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "accountant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files accepted" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 20MB limit" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // Magic-bytes check: PDFs start with "%PDF"
  if (bytes.slice(0, 4).toString() !== "%PDF") {
    return NextResponse.json({ error: "File is not a valid PDF" }, { status: 400 });
  }

  const pdfPath = await saveUploadedPdf(bytes);

  // Create invoice record in 'queued' state. invoiceNumber is provisional — filled in by extraction.
  const inv = await prisma.invoice.create({
    data: {
      invoiceNumber: `PENDING-${Date.now()}`,
      pdfPath,
      status: "queued",
      uploadedById: session.user.id,
    },
  });

  // Fire-and-forget pipeline (in production this would be a Celery enqueue).
  // We don't await — frontend polls /api/invoices/[id]/job for status.
  runPipeline(inv.id).catch((e) => {
    console.error("Pipeline error", inv.id, e);
  });

  return NextResponse.json({ invoiceId: inv.id, jobId: inv.id });
}
