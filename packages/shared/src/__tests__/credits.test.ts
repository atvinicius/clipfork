import { describe, it, expect } from "vitest";
import {
  calculateVideoCredits,
  calculateClonedVideoCredits,
  canAfford,
} from "../credits";
import type { Scene } from "../schemas";

describe("calculateVideoCredits", () => {
  it("returns 1 credit for a talking head video", () => {
    expect(calculateVideoCredits("TALKING_HEAD")).toBe(1);
  });

  it("returns 3 credits for a long talking head video", () => {
    expect(calculateVideoCredits("TALKING_HEAD", 45)).toBe(3);
  });

  it("returns 0.5 credits for a faceless video", () => {
    expect(calculateVideoCredits("FACELESS")).toBe(0.5);
  });

  it("returns 1.5 credits for a long faceless video", () => {
    expect(calculateVideoCredits("FACELESS", 45)).toBe(1.5);
  });
});

describe("calculateClonedVideoCredits", () => {
  it("returns 1 credit for a single talking head scene", () => {
    const scenes: Scene[] = [
      { type: "talking_head", duration_s: 5 },
    ];
    expect(calculateClonedVideoCredits(scenes)).toBe(1);
  });

  it("returns 0.25 credits for a single faceless scene", () => {
    const scenes: Scene[] = [
      { type: "product_broll", duration_s: 3 },
    ];
    expect(calculateClonedVideoCredits(scenes)).toBe(0.25);
  });

  it("returns 1.75 for 1 talking head + 3 faceless scenes", () => {
    const scenes: Scene[] = [
      { type: "talking_head", duration_s: 4 },
      { type: "product_broll", duration_s: 3 },
      { type: "text_overlay", duration_s: 2 },
      { type: "testimonial", duration_s: 3 },
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
