import type { Block } from "./types";

const normalize = (s: string) => s.toLowerCase().replace(/[\s.:#]+/g, " ").trim();

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
  const dist = prev[bl];
  return 1 - dist / Math.max(al, bl);
}

const FUZZY_THRESHOLD = 0.8;

// Find the block whose text best matches the given label. Returns the matched block + confidence.
export function findLabelBlock(
  blocks: Block[],
  labelText: string,
): { block: Block; confidence: number } | null {
  const target = normalize(labelText);
  if (!target) return null;

  // Tier 1: exact match (normalized)
  for (const b of blocks) {
    if (normalize(b.text) === target) {
      return { block: b, confidence: 1 };
    }
  }

  // Tier 2: fuzzy match
  let best: Block | null = null;
  let bestScore = 0;
  for (const b of blocks) {
    const score = similarity(normalize(b.text), target);
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  if (best && bestScore >= FUZZY_THRESHOLD) {
    return { block: best, confidence: bestScore };
  }

  return null;
}

// Extract the value adjacent to a label block:
//   1. block to the right on the same row (±20px Y)
//   2. block directly below on the next row
export function extractAdjacentValue(label: Block, blocks: Block[]): Block | null {
  const [lx1, ly1, lx2, ly2] = label.bbox;
  const lcy = (ly1 + ly2) / 2;

  // Right-of-label on same row
  let rightBest: Block | null = null;
  let rightDist = Infinity;
  for (const b of blocks) {
    if (b === label) continue;
    const [bx1, by1, , by2] = b.bbox;
    const bcy = (by1 + by2) / 2;
    if (Math.abs(bcy - lcy) > 20) continue;
    if (bx1 <= lx2) continue; // must be to the right
    const dx = bx1 - lx2;
    if (dx < rightDist) {
      rightDist = dx;
      rightBest = b;
    }
  }
  if (rightBest) return rightBest;

  // Below-label
  let belowBest: Block | null = null;
  let belowDist = Infinity;
  for (const b of blocks) {
    if (b === label) continue;
    const [bx1, by1, bx2] = b.bbox;
    if (by1 <= ly2) continue; // must be below
    // require x-overlap with label
    if (bx2 < lx1 || bx1 > lx2) continue;
    const dy = by1 - ly2;
    if (dy < belowDist) {
      belowDist = dy;
      belowBest = b;
    }
  }
  return belowBest;
}
