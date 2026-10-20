// Progress is never stored; it is computed on read (PLAN §1 R6).
export type ProgressCounts = { total: number; done: number };

export function weeklyRaw({ total, done }: ProgressCounts): number {
  return total === 0 ? 0 : (done / total) * 100;
}

export function toPercent(raw: number): number {
  return Math.round(raw);
}

export function weeklyPercent(counts: ProgressCounts): number {
  return toPercent(weeklyRaw(counts));
}

// Mean of RAW weekly values, rounded once at the end (R6).
export function goalPercent(raws: number[]): number {
  if (raws.length === 0) return 0;
  return toPercent(raws.reduce((a, b) => a + b, 0) / raws.length);
}
