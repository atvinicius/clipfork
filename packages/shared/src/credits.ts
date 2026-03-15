import type { SceneType } from "./types";

const SCENE_CREDITS: Record<string, number> = {
  talking_head: 1,
  product_broll: 0.25,
  text_overlay: 0.25,
  testimonial: 0.25,
  greenscreen: 0.25,
  hook: 0.25,
  benefit: 0.25,
  demo: 0.25,
  cta: 0.25,
};

/**
 * Calculate credits for a standard (non-cloned) video based on scene count.
 * 2 credits per 5 scenes (or fraction thereof), minimum 1.
 */
export function calculateVideoCredits(sceneCount: number): number {
  return Math.max(1, Math.ceil(sceneCount / 5) * 2);
}

/**
 * Calculate credits for a cloned video based on per-scene type costs.
 */
export function calculateClonedVideoCredits(
  scenes: { type: SceneType | string }[]
): number {
  return scenes.reduce((total, scene) => {
    return total + (SCENE_CREDITS[scene.type] ?? 0.25);
  }, 0);
}

export function canAfford(balance: number, cost: number): boolean {
  return balance >= cost;
}
