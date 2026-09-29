import { describe, it, expect } from "vitest";
import {
  hourBucket,
  engagementRate,
  viewVelocity,
  viewDelta,
  viralityScore,
  isViralOutlier,
  median,
  growthRate,
  OUTLIER_CREATOR_MULTIPLE,
  OUTLIER_MIN_VIEWS,
  OUTLIER_ABSOLUTE_VIEWS,
} from "../intel/scoring";

describe("hourBucket", () => {
  it("truncates to the hour in UTC", () => {
    expect(hourBucket(new Date("2026-09-29T03:47:31Z")).toISOString()).toBe(
      "2026-09-29T03:00:00.000Z"
    );
  });
});

describe("engagementRate", () => {
  it("is zero when views are zero", () => {
    expect(
      engagementRate({ views: 0n, likes: 5, comments: 1, shares: 0, saves: 0 })
    ).toBe(0);
  });
  it("computes percent engagement", () => {
    expect(
      engagementRate({ views: 1000n, likes: 50, comments: 30, shares: 10, saves: 10 })
    ).toBeCloseTo(10);
  });
});

describe("viewVelocity / viewDelta", () => {
  const t = (h: number) => new Date(h * 3_600_000);
  it("needs at least two points", () => {
    expect(viewVelocity([{ collectedAt: t(0), views: 100n }])).toBe(0);
  });
  it("computes views per hour between first and last", () => {
    const pts = [
      { collectedAt: t(0), views: 1000n },
      { collectedAt: t(4), views: 5000n },
    ];
    expect(viewVelocity(pts)).toBeCloseTo(1000);
    expect(viewDelta(pts)).toBe(4000);
  });
  it("handles unsorted input and negative deltas", () => {
    const pts = [
      { collectedAt: t(4), views: 1000n },
      { collectedAt: t(0), views: 5000n },
    ];
    expect(viewVelocity(pts)).toBe(0);
    expect(viewDelta(pts)).toBe(0);
  });
});

describe("viralityScore", () => {
  it("is zero with no velocity", () => {
    expect(viralityScore({ velocityPerHour: 0, engagementRate: 10, ageHours: 1 })).toBe(0);
  });
  it("grows with velocity and engagement", () => {
    const slow = viralityScore({ velocityPerHour: 100, engagementRate: 5, ageHours: 0 });
    const fast = viralityScore({ velocityPerHour: 100_000, engagementRate: 5, ageHours: 0 });
    const engaging = viralityScore({ velocityPerHour: 100_000, engagementRate: 25, ageHours: 0 });
    expect(fast).toBeGreaterThan(slow);
    expect(engaging).toBeGreaterThan(fast);
  });
  it("decays with age", () => {
    const fresh = viralityScore({ velocityPerHour: 10_000, engagementRate: 10, ageHours: 0 });
    const old = viralityScore({ velocityPerHour: 10_000, engagementRate: 10, ageHours: 192 });
    expect(old).toBeLessThan(fresh);
  });
});

describe("isViralOutlier", () => {
  it("flags absolute virality regardless of baseline", () => {
    expect(isViralOutlier(OUTLIER_ABSOLUTE_VIEWS, 0)).toBe(true);
  });
  it("flags 5x creator median above the noise floor", () => {
    expect(isViralOutlier(OUTLIER_MIN_VIEWS, 5_000)).toBe(true);
    expect(isViralOutlier(OUTLIER_MIN_VIEWS, 30_000)).toBe(false);
  });
  it("ignores sub-floor posts", () => {
    expect(isViralOutlier(OUTLIER_MIN_VIEWS - 1, 1)).toBe(false);
  });
});

describe("median / growthRate", () => {
  it("median of odd and even lists", () => {
    expect(median([1, 5, 3])).toBe(3);
    expect(median([10, 20])).toBe(15);
    expect(median([])).toBe(0);
  });
  it("growthRate handles zero previous", () => {
    expect(growthRate(5, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(growthRate(0, 0)).toBe(0);
    expect(growthRate(9, 6)).toBeCloseTo(0.5);
  });
});
