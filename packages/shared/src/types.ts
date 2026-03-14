export type Plan = "FREE" | "STARTER" | "GROWTH" | "SCALE";

export type VideoType = "TALKING_HEAD" | "FACELESS" | "CLONED";

export type SceneType =
  | "talking_head"
  | "product_broll"
  | "text_overlay"
  | "testimonial"
  | "greenscreen";

export interface PlanConfig {
  creditsMonthly: number;
  clonesMonthly: number;
  competitorMonitors: number;
  seats: number;
  brandKits: number | "unlimited";
  batchGeneration: boolean;
  apiAccess: boolean;
  watermark: boolean;
  tiktokPublishing: boolean;
  priorityRendering: boolean;
}

export const PLAN_CONFIGS: Record<Plan, PlanConfig> = {
  FREE: {
    creditsMonthly: 3,
    clonesMonthly: 0,
    competitorMonitors: 0,
    seats: 1,
    brandKits: 1,
    batchGeneration: false,
    apiAccess: false,
    watermark: true,
    tiktokPublishing: false,
    priorityRendering: false,
  },
  STARTER: {
    creditsMonthly: 30,
    clonesMonthly: 5,
    competitorMonitors: 0,
    seats: 1,
    brandKits: 3,
    batchGeneration: false,
    apiAccess: false,
    watermark: false,
    tiktokPublishing: true,
    priorityRendering: false,
  },
  GROWTH: {
    creditsMonthly: 100,
    clonesMonthly: 25,
    competitorMonitors: 5,
    seats: 3,
    brandKits: "unlimited",
    batchGeneration: true,
    apiAccess: false,
    watermark: false,
    tiktokPublishing: true,
    priorityRendering: false,
  },
  SCALE: {
    creditsMonthly: 300,
    clonesMonthly: -1, // -1 = unlimited
    competitorMonitors: 20,
    seats: 10,
    brandKits: "unlimited",
    batchGeneration: true,
    apiAccess: true,
    watermark: false,
    tiktokPublishing: true,
    priorityRendering: true,
  },
};
