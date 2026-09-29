// ---------------------------------------------------------------------------
// Pure scoring math for the intelligence layer. Every function is
// deterministic and unit-tested — the signal engine is just these functions
// applied to snapshot rows.
// ---------------------------------------------------------------------------

/** Hour-truncated UTC bucket used as the snapshot dedupe key. */
export function hourBucket(d: Date): Date {
  const b = new Date(d);
  b.setUTCMinutes(0, 0, 0);
  return b;
}

/** Engagement rate in percent: (likes+comments+shares+saves)/views*100. */
export function engagementRate(m: {
  views: bigint | number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}): number {
  const views = Number(m.views);
  if (views <= 0) return 0;
  return ((m.likes + m.comments + m.shares + m.saves) / views) * 100;
}

export interface SnapshotPoint {
  collectedAt: Date;
  views: bigint | number;
}

/**
 * View velocity in views/hour between the oldest and newest points in a
 * window. Needs >= 2 points; gaps under 1 minute are treated as 1 minute to
 * avoid division blowups on back-to-back scrapes.
 */
export function viewVelocity(points: SnapshotPoint[]): number {
  if (points.length < 2) return 0;
  const sorted = [...points].sort(
    (a, b) => a.collectedAt.getTime() - b.collectedAt.getTime()
  );
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const hours = Math.max(
    (last.collectedAt.getTime() - first.collectedAt.getTime()) / 3_600_000,
    1 / 60
  );
  const delta = Number(last.views) - Number(first.views);
  return delta > 0 ? delta / hours : 0;
}

/** Views gained over the window spanned by the points. */
export function viewDelta(points: SnapshotPoint[]): number {
  if (points.length < 2) return 0;
  const sorted = [...points].sort(
    (a, b) => a.collectedAt.getTime() - b.collectedAt.getTime()
  );
  return Math.max(0, Number(sorted[sorted.length - 1]!.views) - Number(sorted[0]!.views));
}

const HALF_LIFE_HOURS = 96; // a post's score halves every 4 days

/**
 * Virality score: log-scaled velocity, boosted by engagement, decayed with
 * age. ~0 for dead posts, ~1-3 for solid performers, 5+ for breakout viral.
 */
export function viralityScore(input: {
  velocityPerHour: number;
  engagementRate: number;
  ageHours: number;
}): number {
  const { velocityPerHour, engagementRate: er, ageHours } = input;
  if (velocityPerHour <= 0) return 0;
  const velocityTerm = Math.log10(1 + velocityPerHour);
  const engagementTerm = 1 + Math.min(Math.max(er, 0), 50) / 20;
  const decay = Math.pow(0.5, Math.max(ageHours, 0) / HALF_LIFE_HOURS);
  return velocityTerm * engagementTerm * decay;
}

export const OUTLIER_CREATOR_MULTIPLE = 5;
export const OUTLIER_MIN_VIEWS = 50_000;
export const OUTLIER_ABSOLUTE_VIEWS = 5_000_000;

/**
 * A post is an outlier when it massively outperforms its creator's median
 * (5x median, above a noise floor) or clears an absolute viral threshold.
 */
export function isViralOutlier(views: number, creatorMedianViews: number): boolean {
  if (views >= OUTLIER_ABSOLUTE_VIEWS) return true;
  if (views < OUTLIER_MIN_VIEWS) return false;
  if (creatorMedianViews <= 0) return false;
  return views >= creatorMedianViews * OUTLIER_CREATOR_MULTIPLE;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Relative growth of the current window vs the previous one.
 * previous=0 -> returns Infinity when current>0 (caller caps it), else 0.
 */
export function growthRate(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? Number.POSITIVE_INFINITY : 0;
  return (current - previous) / previous;
}
