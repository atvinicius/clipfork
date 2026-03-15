import { describe, it, expect } from "vitest";
import {
  normalizeScenes,
  buildImagePrompt,
  type NormalizedScene,
} from "../processors/scene-generator";

describe("normalizeScenes", () => {
  it("normalizes TALKING_HEAD scenes", () => {
    const scriptVariant = {
      scenes: [
        { type: "hook", text: "Stop scrolling!", duration_s: 3, emotion: "excited", gesture: "point", transition: "cut" },
        { type: "benefit", text: "This product changed my skin", duration_s: 5, emotion: "calm", gesture: "show", transition: "fade" },
      ],
    };
    const result = normalizeScenes("TALKING_HEAD", scriptVariant);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: "hook",
      visualDescription: "Stop scrolling!",
      captionText: "Stop scrolling!",
      duration_s: 3,
      emotion: "excited",
    });
  });

  it("normalizes FACELESS scenes", () => {
    const scriptVariant = {
      scenes: [
        { type: "hook", text_overlay: "Wait for it...", voiceover: "You won't believe this", broll_description: "dramatic product reveal close-up", duration_s: 3, transition: "cut" },
      ],
    };
    const result = normalizeScenes("FACELESS", scriptVariant);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "hook",
      visualDescription: "dramatic product reveal close-up",
      captionText: "You won't believe this",
      duration_s: 3,
      emotion: undefined,
    });
  });

  it("normalizes CLONED scenes — flattens hook + scenes + cta", () => {
    const scriptVariant = {
      hook: { type: "hook", duration_s: 3, text_overlay: "Big reveal" },
      scenes: [
        { type: "demo", duration_s: 5, text_overlay: "Watch this" },
      ],
      cta: { type: "cta", duration_s: 2, text_overlay: "Buy now" },
    };
    const result = normalizeScenes("CLONED", scriptVariant);
    expect(result).toHaveLength(3);
    expect(result[0]!.type).toBe("hook");
    expect(result[0]!.captionText).toBe("Big reveal");
    expect(result[2]!.type).toBe("cta");
  });
});

describe("buildImagePrompt", () => {
  it("builds prompt with preset style", () => {
    const scene: NormalizedScene = {
      type: "hook",
      visualDescription: "person holding serum bottle",
      captionText: "This changed everything",
      duration_s: 3,
    };
    const prompt = buildImagePrompt(scene, {
      sceneStyles: { hook: "extreme close-up of glowing dewy skin, soft studio lighting" },
      productName: "Glow Serum",
      loraTriggerWord: undefined,
    });
    expect(prompt).toContain("extreme close-up of glowing dewy skin");
    expect(prompt).toContain("Glow Serum");
    expect(prompt).toContain("person holding serum bottle");
    expect(prompt).toContain("professional product photography");
  });

  it("includes LoRA trigger word when provided", () => {
    const scene: NormalizedScene = {
      type: "demo",
      visualDescription: "product on table",
      captionText: "Demo time",
      duration_s: 5,
    };
    const prompt = buildImagePrompt(scene, {
      sceneStyles: {},
      productName: "Widget",
      loraTriggerWord: "mybrand_style",
    });
    expect(prompt).toContain("in the style of mybrand_style");
  });

  it("uses default scene style when preset has no match", () => {
    const scene: NormalizedScene = {
      type: "hook",
      visualDescription: "dramatic reveal",
      captionText: "Wow",
      duration_s: 3,
    };
    const prompt = buildImagePrompt(scene, {
      sceneStyles: {},
      productName: "Widget",
      loraTriggerWord: undefined,
    });
    expect(prompt).toContain("dramatic reveal");
    expect(prompt).toContain("professional product photography");
  });
});
