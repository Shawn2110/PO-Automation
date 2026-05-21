// HTTP client for the Modal VLM sidecar (../modal-vlm/app.py).
// Replaces the Tesseract OCR sidecar — this one returns the six canonical
// invoice fields directly instead of OCR blocks.

const VLM_URL = process.env.MODAL_VLM_URL;
const VLM_TOKEN = process.env.MODAL_AUTH_TOKEN;

export type VlmFields = {
  invoiceNumber: string | null;
  invoiceDate: string | null;       // ISO 8601 (YYYY-MM-DD)
  vendorName: string | null;
  gstNumber: string | null;
  amountBeforeGst: number | null;
  amountAfterGst: number | null;
  gstPct: number | null;
  confidence: number;                // 0..1, field-completeness
  engine: string;
  durationMs: number;
};

export class VlmError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

export async function runVlmExtract(pdfBuffer: Buffer): Promise<VlmFields> {
  if (!VLM_URL) {
    throw new VlmError(
      "MODAL_VLM_URL is not set. Deploy modal-vlm/ first (`modal deploy app.py`) and set the URL in this env.",
    );
  }
  if (!VLM_TOKEN) {
    throw new VlmError("MODAL_AUTH_TOKEN is not set.");
  }

  const form = new FormData();
  form.append("pdf", new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }), "invoice.pdf");

  let res: Response;
  try {
    res = await fetch(`${VLM_URL}/extract`, {
      method: "POST",
      headers: { Authorization: `Bearer ${VLM_TOKEN}` },
      body: form,
      // 5 min covers the worst-case cold start (Modal L4 spinning up + weight load).
      signal: AbortSignal.timeout(300_000),
    });
  } catch (e) {
    throw new VlmError(
      `Could not reach Modal VLM at ${VLM_URL}. Is it deployed? (modal deploy app.py)`,
      e,
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let pretty = detail.slice(0, 400);
    try {
      const parsed = JSON.parse(detail);
      if (parsed?.detail) pretty = String(parsed.detail).slice(0, 400);
    } catch {
      /* not JSON, use raw text */
    }
    throw new VlmError(`Modal VLM returned ${res.status}: ${pretty}`);
  }

  const data = (await res.json()) as VlmFields;
  return data;
}
