export type Block = {
  text: string;
  bbox: [number, number, number, number]; // x1, y1, x2, y2 in image pixels
  confidence: number;
};

export type CanonicalField =
  | "invoiceDate"
  | "invoiceNumber"
  | "clientName"
  | "amountBeforeGst"
  | "amountAfterGst";

export type TemplateLabels = Partial<Record<CanonicalField, string | null>>;

export type ExtractedField<T> = { value: T | null; confidence: number; sourceText?: string };

export type ExtractionResult = {
  invoiceDate:      ExtractedField<Date>;
  invoiceNumber:    ExtractedField<string>;
  clientName:       ExtractedField<string>;
  amountBeforeGst:  ExtractedField<number>;
  amountAfterGst:   ExtractedField<number>;
  gstPct: number | null;
  gstMismatch: boolean;
  overallConfidence: number;
  needsReview: boolean;
};

// GSTIN: 15 chars — state(2) + PAN(10: 5 letters + 4 digits + 1 letter) + entity(1)
// + "Z" + checksum(1 alphanumeric). The agent.md/prd.md spec had only 14 chars
// (missing the trailing checksum), which silently rejected real-world GSTs.
export const GST_PATTERN = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9][A-Z][A-Z0-9]\b/;
export const LOW_CONFIDENCE = 0.7;
