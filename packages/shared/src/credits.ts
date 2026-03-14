import type { SceneType, VideoType } from "./types";

const TALKING_HEAD_CREDIT_PER_15S = 1;
const FACELESS_CREDIT_PER_15S = 0.5;
const SCENE_CREDITS: Record<SceneType, number> = {
  talking_head: 1,
  product_broll: 0.25,
  text_overlay: 0.25,
  testimonial: 0.25,
  greenscreen: 0.25,
};

export function calculateVideoCredits(
  type: VideoType,
  durationSeconds: number = 15
): number {
  if (type === "CLONED") {
    throw new Error(
      "Use calculateClonedVideoCredits() for CLONED videos — requires scene list"
    );
  }
  const segments = Math.ceil(durationSeconds / 15);
  if (type === "TALKING_HEAD") {
    return segments * TALKING_HEAD_CREDIT_PER_15S;
  }
  return segments * FACELESS_CREDIT_PER_15S;
}

export function calculateClonedVideoCredits(
  scenes: { type: SceneType }[]
): number {
  return scenes.reduce((total, scene) => {
    return total + (SCENE_CREDITS[scene.type] ?? 0.25);
  }, 0);
}

export function canAfford(balance: number, cost: number): boolean {
  return balance >= cost;
}
