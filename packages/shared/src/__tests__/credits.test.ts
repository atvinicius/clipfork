import { describe, it, expect } from "vitest";
import {
  calculateVideoCredits,
  calculateClonedVideoCredits,
  canAfford,
} from "../credits";

describe("calculateVideoCredits", () => {
  it("returns 2 credits for 5 scenes", () => {
    expect(calculateVideoCredits(5)).toBe(2);
  });

  it("returns 2 credits for fewer than 5 scenes (1 chunk)", () => {
    expect(calculateVideoCredits(3)).toBe(2);
  });

  it("returns 4 credits for 6-10 scenes", () => {
    expect(calculateVideoCredits(8)).toBe(4);
  });

  it("returns 2 for 1 scene", () => {
    expect(calculateVideoCredits(1)).toBe(2);
  });

  it("returns 6 for 15 scenes", () => {
    expect(calculateVideoCredits(15)).toBe(6);
  });
});

describe("calculateClonedVideoCredits", () => {
  it("returns 1 credit for a single talking head scene", () => {
    const scenes = [{ type: "talking_head" as const, duration_s: 5 }];
    expect(calculateClonedVideoCredits(scenes)).toBe(1);
  });

  it("returns 0.25 credits for a single broll scene", () => {
    const scenes = [{ type: "product_broll" as const, duration_s: 3 }];
    expect(calculateClonedVideoCredits(scenes)).toBe(0.25);
  });

  it("returns 1.75 for 1 talking head + 3 faceless scenes", () => {
    const scenes = [
      { type: "talking_head" as const, duration_s: 4 },
      { type: "product_broll" as const, duration_s: 3 },
      { type: "text_overlay" as const, duration_s: 2 },
      { type: "testimonial" as const, duration_s: 3 },
    ];
    expect(calculateClonedVideoCredits(scenes)).toBe(1.75);
  });
});

describe("canAfford", () => {
  it("returns true when balance is sufficient", () => {
    expect(canAfford(10, 3)).toBe(true);
  });

  it("returns true when balance equals cost", () => {
    expect(canAfford(3, 3)).toBe(true);
  });

  it("returns false when balance is insufficient", () => {
    expect(canAfford(2, 3)).toBe(false);
  });
});
