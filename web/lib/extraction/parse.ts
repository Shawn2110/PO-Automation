// Parse currency / amount tokens.
//   "₹2,45,000"   → 245000
//   "2,89,100.00" → 289100
//   "Rs. 94,500"  → 94500
export function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[₹$,\s]|Rs\.?/gi, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Parse Indian-style dates. Tries multiple formats; defaults to day-first interpretation.
//   "15 Jan 2024" / "15/01/2024" / "2024-01-15" / "15-01-24"
export function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();

  // ISO 8601
  const iso = Date.parse(s);
  if (!Number.isNaN(iso) && /^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(iso);

  // Month name e.g. "15 Jan 2024" or "15 January 2024"
  const monthRe = /^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i;
  const mm = s.match(monthRe);
  if (mm) {
    const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const month = months[mm[2].slice(0, 3).toLowerCase()];
    let year = parseInt(mm[3], 10);
    if (year < 100) year += 2000;
    const day = parseInt(mm[1], 10);
    const d = new Date(Date.UTC(year, month, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Numeric dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
  const numRe = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/;
  const nm = s.match(numRe);
  if (nm) {
    const day = parseInt(nm[1], 10);
    const month = parseInt(nm[2], 10);
    let year = parseInt(nm[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Fallback: native Date.parse
  const fallback = Date.parse(s);
  return Number.isNaN(fallback) ? null : new Date(fallback);
}

// GST sanity check: derived rate ≈ declared rate within tolerance.
export function deriveGstPct(amountBeforeGst: number, amountAfterGst: number): number {
  if (amountBeforeGst <= 0) return 0;
  return ((amountAfterGst - amountBeforeGst) / amountBeforeGst) * 100;
}

// Closest standard GST slab in India.
const STANDARD_RATES = [0, 3, 5, 12, 18, 28];
export function snapToStandardRate(rate: number): number {
  let best = STANDARD_RATES[0];
  let bestDiff = Math.abs(rate - best);
  for (const r of STANDARD_RATES) {
    const d = Math.abs(rate - r);
    if (d < bestDiff) { best = r; bestDiff = d; }
  }
  return best;
}

export function isGstMismatch(derivedPct: number, declaredPct: number, tolerance = 0.5): boolean {
  return Math.abs(derivedPct - declaredPct) > tolerance;
}
