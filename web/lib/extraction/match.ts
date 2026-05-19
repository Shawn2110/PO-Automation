import type { Block } from "./types";

const normalize = (s: string) => s.toLowerCase().replace(/[\s.:#]+/g, " ").trim();
const stripWs = (s: string) => s.toLowerCase().replace(/\s+/g, "");

// Levenshtein-based similarity score 0..1 (matches RapidFuzz.ratio / 100).
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const al = a.length, bl = b.length;
  const prev: number[] = new Array(bl + 1);
  const curr: number[] = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= bl; j++) prev[j] = curr[j];
  }
  return 1 - prev[bl] / Math.max(al, bl);
}

const FUZZY_THRESHOLD = 0.8;

export type LabelMatch = {
  block: Block;
  confidence: number;
  matchType: "exact" | "fuzzy" | "prefix" | "contains";
  // For prefix/contains matches: the value text inside the same block.
  inlineValue?: string;
};

// Strip leading separator characters (colon, dash, em-dash, etc.) so an
// inline value like "— 16,283.72" becomes "16,283.72".
function trimSeparators(s: string): string {
  return s.replace(/^[\s:\-.,–—|=]+/, "").trim();
}

// Try to extract the value that appears AFTER the label inside the same block.
// Uses two strategies: exact substring (whitespace-aware) then whitespace-stripped
// (to handle OCR concatenations like "INVOICETOTAL").
function extractInlineValueAfter(blockText: string, label: string): string | null {
  const lower = blockText.toLowerCase();
  const labelLower = label.toLowerCase();
  const idx = lower.indexOf(labelLower);
  if (idx !== -1) {
    const remainder = blockText.slice(idx + label.length);
    const cleaned = trimSeparators(remainder);
    return cleaned.length > 0 ? cleaned : null;
  }

  // Whitespace-stripped fallback: "INVOICETOTAL 19,155.79" matches "Invoice Total"
  const blockStripped = stripWs(blockText);
  const labelStripped = stripWs(label);
  const sIdx = blockStripped.indexOf(labelStripped);
  if (sIdx === -1) return null;

  // Walk the original string until we've consumed labelStripped.length non-whitespace
  // characters past sIdx — that's where the value starts in the un-stripped text.
  const startSkip = sIdx + labelStripped.length;
  let origIdx = 0;
  let consumed = 0;
  while (origIdx < blockText.length && consumed < startSkip) {
    if (!/\s/.test(blockText[origIdx])) consumed++;
    origIdx++;
  }
  const remainder = blockText.slice(origIdx);
  const cleaned = trimSeparators(remainder);
  return cleaned.length > 0 ? cleaned : null;
}

// Find the block whose text best matches the given label across five tiers.
export function findLabelBlock(blocks: Block[], labelText: string): LabelMatch | null {
  const target = normalize(labelText);
  if (!target) return null;

  // Tier 1: exact match (normalized)
  for (const b of blocks) {
    if (normalize(b.text) === target) {
      return { block: b, confidence: 1, matchType: "exact" };
    }
  }

  // Tier 2: fuzzy match on the entire block
  let bestFuzzy: { block: Block; score: number } | null = null;
  for (const b of blocks) {
    const score = similarity(normalize(b.text), target);
    if (!bestFuzzy || score > bestFuzzy.score) bestFuzzy = { block: b, score };
  }
  if (bestFuzzy && bestFuzzy.score >= FUZZY_THRESHOLD) {
    return { block: bestFuzzy.block, confidence: bestFuzzy.score, matchType: "fuzzy" };
  }

  // Tier 3: label is the prefix of a longer block ("Date of Issue 18/04/2026")
  for (const b of blocks) {
    const blockNorm = normalize(b.text);
    if (blockNorm.startsWith(target + " ")) {
      const inline = extractInlineValueAfter(b.text, labelText);
      if (inline) return { block: b, confidence: 0.88, matchType: "prefix", inlineValue: inline };
    }
  }

  // Tier 4: label appears as a whole-word substring anywhere in a block
  //         ("nus TAXABLE VALUE — 16,283.72")
  for (const b of blocks) {
    const blockNorm = " " + normalize(b.text) + " ";
    const padded = " " + target + " ";
    const idx = blockNorm.indexOf(padded);
    if (idx === -1) continue;
    const inline = extractInlineValueAfter(b.text, labelText);
    if (inline) return { block: b, confidence: 0.75, matchType: "contains", inlineValue: inline };
  }

  // Tier 5: whitespace-stripped contains ("INVOICETOTAL" matches "Invoice Total")
  const labelStripped = stripWs(labelText);
  if (labelStripped.length >= 4) {
    for (const b of blocks) {
      const blockStripped = stripWs(b.text);
      if (!blockStripped.includes(labelStripped)) continue;
      const inline = extractInlineValueAfter(b.text, labelText);
      if (inline) return { block: b, confidence: 0.65, matchType: "contains", inlineValue: inline };
    }
  }

  return null;
}

// Extract the value for a matched label.
//   prefix / contains → inline value (already computed during matching)
//   exact / fuzzy    → look in adjacent blocks (right same-row, then below)
export function extractValueForMatch(match: LabelMatch, blocks: Block[]): string | null {
  if (match.inlineValue) return match.inlineValue;
  const adj = extractAdjacentValue(match.block, blocks);
  return adj?.text.trim() ?? null;
}

export function extractAdjacentValue(label: Block, blocks: Block[]): Block | null {
  const [lx1, ly1, lx2, ly2] = label.bbox;
  const lcy = (ly1 + ly2) / 2;

  let rightBest: Block | null = null;
  let rightDist = Infinity;
  for (const b of blocks) {
    if (b === label) continue;
    const [bx1, by1, , by2] = b.bbox;
    const bcy = (by1 + by2) / 2;
    if (Math.abs(bcy - lcy) > 20) continue;
    if (bx1 <= lx2) continue;
    const dx = bx1 - lx2;
    if (dx < rightDist) { rightDist = dx; rightBest = b; }
  }
  if (rightBest) return rightBest;

  let belowBest: Block | null = null;
  let belowDist = Infinity;
  for (const b of blocks) {
    if (b === label) continue;
    const [bx1, by1, bx2] = b.bbox;
    if (by1 <= ly2) continue;
    if (bx2 < lx1 || bx1 > lx2) continue;
    const dy = by1 - ly2;
    if (dy < belowDist) { belowDist = dy; belowBest = b; }
  }
  return belowBest;
}
