// Heuristic template auto-detection.
//
// When a vendor has no saved template, try to identify the 5 canonical labels
// using a built-in list of common synonyms. If all five are found with
// reasonable confidence, the pipeline saves them as the vendor's template and
// proceeds to extraction normally — the user never sees a mapping prompt.
//
// This is layered ON TOP of the manual template mapping flow. If auto-detect
// can't confidently identify all five fields, we still fall back to
// needs_mapping and ask the accountant.

import type { Block, CanonicalField, TemplateLabels } from "./types";
import { findLabelBlock } from "./match";

// Canonical synonyms per field. Order doesn't matter — we pick the best match.
// Keep the entries short and specific; long phrases hurt fuzzy matching.
const SYNONYMS: Record<CanonicalField, string[]> = {
  invoiceDate: [
    "Invoice Date", "Bill Date", "Date of Issue", "Issue Date",
    "Invoice Dt.", "Bill Dt.", "Document Date", "Doc Date",
    "Dated", "Date",
  ],
  invoiceNumber: [
    "Invoice No.", "Invoice Number", "Tax Invoice No.",
    "Bill No.", "Bill Number", "Inv No.", "Inv #",
    "Document No.", "Doc No.", "Ref No.", "Serial No.",
  ],
  clientName: [
    "Bill To", "Billed To", "Buyer", "Buyer Name",
    "Customer", "Customer Name", "Party Name",
    "Ship To", "Shipped To", "Consignee", "Sold To",
    "Recipient", "Name & Address of the Recipient",
  ],
  amountBeforeGst: [
    "Taxable Value", "Taxable Amount", "Taxable Amt",
    "Sub Total", "Subtotal", "Net Amount",
    "Basic Value", "Basic Amount",
    "Total Before Tax", "Amount Before GST",
  ],
  amountAfterGst: [
    "Grand Total", "Total Payable", "Invoice Total",
    "Total Amount", "Amount Payable", "Net Payable",
    "Bill Total", "Final Amount",
    "Total (Incl. GST)", "Amount After GST",
  ],
};

// Accepts matches from Tiers 1-5 in match.ts. Tier 5 (whitespace-stripped
// substring) returns 0.65; everything stronger ranks higher.
const MIN_LABEL_CONFIDENCE = 0.6;

// For each canonical field, find the synonym that best matches some OCR block.
// Returns the synonym string (canonical form) when confident, null otherwise.
// We store the synonym rather than the raw OCR text so the saved template stays
// human-readable (and downstream findLabelBlock fuzz-matches it back to OCR).
export function autoDetectLabels(blocks: Block[]): TemplateLabels {
  const result: TemplateLabels = {};

  for (const field of Object.keys(SYNONYMS) as CanonicalField[]) {
    let best: { synonym: string; confidence: number } | null = null;
    for (const synonym of SYNONYMS[field]) {
      const m = findLabelBlock(blocks, synonym);
      if (!m) continue;
      if (!best || m.confidence > best.confidence) {
        best = { synonym, confidence: m.confidence };
      }
    }
    result[field] = best && best.confidence >= MIN_LABEL_CONFIDENCE ? best.synonym : null;
  }

  return result;
}

export function allLabelsFound(labels: TemplateLabels): boolean {
  return (
    !!labels.invoiceDate &&
    !!labels.invoiceNumber &&
    !!labels.clientName &&
    !!labels.amountBeforeGst &&
    !!labels.amountAfterGst
  );
}

// How many of the 5 canonical fields the heuristic identified — useful for
// audit logs and partial-match diagnostics.
export function countLabelsFound(labels: TemplateLabels): number {
  return [
    labels.invoiceDate, labels.invoiceNumber, labels.clientName,
    labels.amountBeforeGst, labels.amountAfterGst,
  ].filter((l) => l != null && l.length > 0).length;
}
