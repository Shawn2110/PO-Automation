import { type Block, type CanonicalField, type ExtractedField, type ExtractionResult, type TemplateLabels, LOW_CONFIDENCE } from "./types";
import { findLabelBlock, extractAdjacentValue } from "./match";
import { parseAmount, parseDate, deriveGstPct, snapToStandardRate, isGstMismatch } from "./parse";

function extractRaw(blocks: Block[], labelText: string | null | undefined): { raw: string; confidence: number } | null {
  if (!labelText) return null;
  const m = findLabelBlock(blocks, labelText);
  if (!m) return null;
  const value = extractAdjacentValue(m.block, blocks);
  if (!value) return null;
  return {
    raw: value.text.trim(),
    confidence: Math.min(m.confidence, value.confidence),
  };
}

export function runExtraction(blocks: Block[], template: TemplateLabels): ExtractionResult {
  const date  = extractRaw(blocks, template.invoiceDate);
  const num   = extractRaw(blocks, template.invoiceNumber);
  const cli   = extractRaw(blocks, template.clientName);
  const bg    = extractRaw(blocks, template.amountBeforeGst);
  const ag    = extractRaw(blocks, template.amountAfterGst);

  const invoiceDate: ExtractedField<Date> = date
    ? { value: parseDate(date.raw), confidence: parseDate(date.raw) ? date.confidence : 0, sourceText: date.raw }
    : { value: null, confidence: 0 };

  const invoiceNumber: ExtractedField<string> = num
    ? { value: num.raw || null, confidence: num.raw ? num.confidence : 0, sourceText: num.raw }
    : { value: null, confidence: 0 };

  const clientName: ExtractedField<string> = cli
    ? { value: cli.raw || null, confidence: cli.raw ? cli.confidence : 0, sourceText: cli.raw }
    : { value: null, confidence: 0 };

  const beforeVal = bg ? parseAmount(bg.raw) : null;
  const afterVal  = ag ? parseAmount(ag.raw) : null;

  const amountBeforeGst: ExtractedField<number> = bg
    ? { value: beforeVal, confidence: beforeVal != null ? bg.confidence : 0, sourceText: bg.raw }
    : { value: null, confidence: 0 };

  const amountAfterGst: ExtractedField<number> = ag
    ? { value: afterVal, confidence: afterVal != null ? ag.confidence : 0, sourceText: ag.raw }
    : { value: null, confidence: 0 };

  let gstPct: number | null = null;
  let gstMismatch = false;
  if (beforeVal != null && afterVal != null && beforeVal > 0) {
    const derived = deriveGstPct(beforeVal, afterVal);
    gstPct = snapToStandardRate(derived);
    gstMismatch = isGstMismatch(derived, gstPct, 0.5);
  }

  const confidences = [invoiceDate, invoiceNumber, clientName, amountBeforeGst, amountAfterGst].map((f) => f.confidence);
  const overallConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const needsReview = confidences.some((c) => c < LOW_CONFIDENCE) || gstMismatch;

  return { invoiceDate, invoiceNumber, clientName, amountBeforeGst, amountAfterGst, gstPct, gstMismatch, overallConfidence, needsReview };
}

// Best-effort vendor name fuzzy guess for invoices without GST detection.
export function pickVendorNameCandidate(blocks: Block[]): string | null {
  // Strategy: in absence of GST, the top-of-page largest-confidence text is usually vendor name.
  const top = [...blocks]
    .filter((b) => b.text.trim().length >= 4 && b.text.trim().length <= 60)
    .sort((a, b) => a.bbox[1] - b.bbox[1])
    .slice(0, 10);
  return top[0]?.text.trim() ?? null;
}

export { GST_PATTERN } from "./types";
