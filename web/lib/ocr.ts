import type { Block } from "@/lib/extraction/types";

const OCR_URL = process.env.OCR_SERVICE_URL ?? "http://127.0.0.1:8001";

export type OcrResponse = {
  blocks: Block[];
  overallConfidence: number;
  engine: string;
};

export class OcrError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

// POST the PDF to the Python sidecar and get back structured blocks.
export async function runOcr(pdfPath: string): Promise<OcrResponse> {
  try {
    const res = await fetch(`${OCR_URL}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdf_path: pdfPath }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // FastAPI returns JSON like { "detail": "TesseractNotFoundError: tesseract is not installed…" }
      let pretty = detail.slice(0, 400);
      try {
        const parsed = JSON.parse(detail);
        if (parsed?.detail) pretty = String(parsed.detail).slice(0, 400);
      } catch { /* not JSON, use raw text */ }
      throw new OcrError(`OCR service returned ${res.status}: ${pretty}`);
    }
    const data = await res.json() as {
      blocks: Block[];
      overall_confidence: number;
      engine: string;
    };
    return {
      blocks: data.blocks,
      overallConfidence: data.overall_confidence,
      engine: data.engine,
    };
  } catch (e) {
    if (e instanceof OcrError) throw e;
    throw new OcrError(
      `Could not reach OCR sidecar at ${OCR_URL}. Is the Python service running? (npm run dev:ocr or python ocr-service/app.py)`,
      e,
    );
  }
}
