import { Job } from "bullmq";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@ugc/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScriptJobData {
  videoId: string;
  productData: {
    title: string;
    description: string;
    images: string[];
    price: string | null;
    reviews: Array<{ text: string; rating?: number; author?: string }>;
  };
  videoType: "TALKING_HEAD" | "FACELESS" | "CLONED";
  brandKit: {
    toneOfVoice: string;
    targetAudience: string | null;
    colors: Record<string, string>;
  } | null;
  templateStructure: {
    structure: {
      hook: { type: string; duration_s: number; text_overlay?: boolean };
      scenes: Array<{
        type: string;
        duration_s: number;
        emotion?: string;
        gesture?: string;
        transition?: string;
        text_overlay?: boolean | string;
      }>;
      cta: { type: string; duration_s: number; text_overlay?: boolean };
    };
    style: {
      pacing: string;
      music_mood: string;
      caption_style: string;
      color_tone: string;
    };
    format: {
      aspect: string;
      total_duration_s: number;
    };
  } | null;
}

interface TalkingHeadScene {
  type: "hook" | "benefit" | "demo" | "testimonial" | "cta";
  text: string;
  duration_s: number;
  emotion: string;
  gesture: string;
  transition: string;
}

interface FacelessScene {
  type: "hook" | "benefit" | "demo" | "testimonial" | "cta";
  text_overlay: string;
  voiceover: string;
  broll_description: string;
  duration_s: number;
  transition: string;
}

interface ClonedScene {
  type: string;
  text: string;
  duration_s: number;
  emotion?: string;
  gesture?: string;
  transition?: string;
  text_overlay?: string;
}

// ---------------------------------------------------------------------------
// Anthropic client
// ---------------------------------------------------------------------------

function getAnthropicClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });
}

const SYSTEM_PROMPT = `You are a viral UGC ad script writer. Generate scripts that feel authentic, conversational, and native to TikTok/Instagram. Never use AI-sounding language.

Rules:
- Write like a real person talking to their friend
- Use casual, conversational language
- Include natural pauses and emphasis markers
- Keep sentences short and punchy
- Avoid corporate buzzwords
- Every hook must be scroll-stopping
- Benefits should be specific and relatable
- CTAs should feel natural, not salesy`;

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildTalkingHeadPrompt(
  productData: ScriptJobData["productData"],
  brandKit: ScriptJobData["brandKit"]
): string {
  const toneGuide = brandKit
    ? `\nTone: ${brandKit.toneOfVoice}. Target audience: ${brandKit.targetAudience ?? "general"}.`
    : "";

  return `Generate a UGC talking-head video script for this product:

Product: ${productData.title}
Description: ${productData.description}
Price: ${productData.price ?? "not specified"}
${productData.reviews.length > 0 ? `Reviews: ${productData.reviews.map((r) => r.text).join(" | ")}` : ""}
${toneGuide}

Return ONLY a JSON array of scenes with this exact structure:
[
  { "type": "hook", "text": "scroll-stopping opening line", "duration_s": 2.5, "emotion": "excited", "gesture": "look at camera", "transition": "cut" },
  { "type": "benefit", "text": "first key benefit", "duration_s": 3, "emotion": "genuine", "gesture": "hand gesture", "transition": "cut" },
  { "type": "benefit", "text": "second key benefit", "duration_s": 3, "emotion": "surprised", "gesture": "point at product", "transition": "cut" },
  { "type": "benefit", "text": "third benefit or social proof", "duration_s": 2.5, "emotion": "confident", "gesture": "nod", "transition": "cut" },
  { "type": "cta", "text": "natural call to action", "duration_s": 2.5, "emotion": "friendly", "gesture": "point down", "transition": "fade" }
]

Requirements:
- Hook must be 2-3 seconds, extremely attention-grabbing
- 2-3 benefit scenes, each 2-4 seconds
- CTA must be 2-3 seconds
- Total video: 12-18 seconds
- Make it feel authentic, not scripted`;
}

function buildFacelessPrompt(
  productData: ScriptJobData["productData"],
  brandKit: ScriptJobData["brandKit"]
): string {
  const toneGuide = brandKit
    ? `\nTone: ${brandKit.toneOfVoice}. Target audience: ${brandKit.targetAudience ?? "general"}.`
    : "";

  return `Generate a faceless UGC video script for this product:

Product: ${productData.title}
Description: ${productData.description}
Price: ${productData.price ?? "not specified"}
${productData.reviews.length > 0 ? `Reviews: ${productData.reviews.map((r) => r.text).join(" | ")}` : ""}
${toneGuide}

Return ONLY a JSON array of scenes with this exact structure:
[
  { "type": "hook", "text_overlay": "bold hook text on screen", "voiceover": "voiceover text for this scene", "broll_description": "description of product footage to show", "duration_s": 3, "transition": "zoom_in" },
  { "type": "benefit", "text_overlay": "key benefit text", "voiceover": "voiceover explaining benefit", "broll_description": "product being used or close-up shot", "duration_s": 3.5, "transition": "swipe" },
  { "type": "demo", "text_overlay": "demo caption", "voiceover": "showing how it works", "broll_description": "hands using product", "duration_s": 4, "transition": "cut" },
  { "type": "cta", "text_overlay": "call to action text", "voiceover": "natural CTA voiceover", "broll_description": "product hero shot", "duration_s": 2.5, "transition": "fade" }
]

Requirements:
- Hook: 2-3s, bold text overlay, attention-grabbing voiceover
- 2-3 benefit/demo scenes, 3-4s each
- CTA: 2-3s
- Total: 12-18 seconds
- text_overlay should be short (5-8 words max)
- voiceover should be conversational
- broll_description should describe specific visual content`;
}

function buildClonedPrompt(
  productData: ScriptJobData["productData"],
  brandKit: ScriptJobData["brandKit"],
  templateStructure: NonNullable<ScriptJobData["templateStructure"]>
): string {
  const toneGuide = brandKit
    ? `\nTone: ${brandKit.toneOfVoice}. Target audience: ${brandKit.targetAudience ?? "general"}.`
    : "";

  const templateInfo = JSON.stringify(templateStructure.structure, null, 2);

  return `Generate a UGC video script that matches this template structure exactly:

Template structure:
${templateInfo}

Style: ${templateStructure.style.pacing} pacing, ${templateStructure.style.music_mood} music
Total duration: ${templateStructure.format.total_duration_s}s

Product: ${productData.title}
Description: ${productData.description}
Price: ${productData.price ?? "not specified"}
${productData.reviews.length > 0 ? `Reviews: ${productData.reviews.map((r) => r.text).join(" | ")}` : ""}
${toneGuide}

Return ONLY a JSON object with this structure:
{
  "hook": { "type": "${templateStructure.structure.hook.type}", "text": "hook text matching the template type", "duration_s": ${templateStructure.structure.hook.duration_s}, "emotion": "appropriate emotion", "gesture": "matching gesture", "transition": "cut" },
  "scenes": [
    // One scene for each scene in the template, matching type and duration
  ],
  "cta": { "type": "${templateStructure.structure.cta.type}", "text": "CTA text", "duration_s": ${templateStructure.structure.cta.duration_s}, "emotion": "friendly", "gesture": "point down", "transition": "fade" }
}

Each scene MUST match the template's scene type and approximate duration.
For each scene include: type, text, duration_s, emotion, gesture, transition, text_overlay (if template has text_overlay).
Make the content feel authentic to the product while matching the template pacing.`;
}

// ---------------------------------------------------------------------------
// Script parsing
// ---------------------------------------------------------------------------

function parseJsonFromResponse(text: string): unknown {
  // Try to extract JSON from the response, handling markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1]!.trim() : text.trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    // Try to find the first [ or { and parse from there
    const arrayStart = jsonStr.indexOf("[");
    const objStart = jsonStr.indexOf("{");
    const start = Math.min(
      arrayStart >= 0 ? arrayStart : Infinity,
      objStart >= 0 ? objStart : Infinity
    );

    if (start === Infinity) {
      throw new Error("No JSON found in response");
    }

    const isArray = jsonStr[start] === "[";
    const end = isArray ? jsonStr.lastIndexOf("]") : jsonStr.lastIndexOf("}");

    if (end <= start) {
      throw new Error("Malformed JSON in response");
    }

    return JSON.parse(jsonStr.substring(start, end + 1));
  }
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processScriptJob(job: Job<ScriptJobData>) {
  const { videoId, productData, videoType, brandKit, templateStructure } =
    job.data;

  console.log(`[script] Generating ${videoType} script for video ${videoId}`);

  try {
    // Update video status
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "SCRIPTING" },
    });

    const anthropic = getAnthropicClient();

    // Build prompt based on video type
    let userPrompt: string;
    switch (videoType) {
      case "TALKING_HEAD":
        userPrompt = buildTalkingHeadPrompt(productData, brandKit);
        break;
      case "FACELESS":
        userPrompt = buildFacelessPrompt(productData, brandKit);
        break;
      case "CLONED":
        if (!templateStructure) {
          throw new Error("CLONED video type requires a templateStructure");
        }
        userPrompt = buildClonedPrompt(productData, brandKit, templateStructure);
        break;
      default:
        throw new Error(`Unknown video type: ${videoType}`);
    }

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in Claude response");
    }

    const parsedScript = parseJsonFromResponse(textContent.text);

    // Build a flat script string for TTS
    let scriptText: string;
    let scriptVariant: unknown;

    if (videoType === "TALKING_HEAD") {
      const scenes = parsedScript as TalkingHeadScene[];
      scriptText = scenes.map((s) => s.text).join(" ");
      scriptVariant = { type: "TALKING_HEAD", scenes };
    } else if (videoType === "FACELESS") {
      const scenes = parsedScript as FacelessScene[];
      scriptText = scenes.map((s) => s.voiceover).join(" ");
      scriptVariant = { type: "FACELESS", scenes };
    } else {
      // CLONED - parse hook + scenes + cta into flat list
      const clonedScript = parsedScript as {
        hook: ClonedScene;
        scenes: ClonedScene[];
        cta: ClonedScene;
      };
      const allScenes = [
        clonedScript.hook,
        ...clonedScript.scenes,
        clonedScript.cta,
      ];
      scriptText = allScenes.map((s) => s.text).join(" ");
      scriptVariant = { type: "CLONED", ...clonedScript };
    }

    // Update Video record
    await prisma.video.update({
      where: { id: videoId },
      data: {
        script: scriptText,
        scriptVariant: scriptVariant as object,
      },
    });

    console.log(`[script] Script generated for video ${videoId}`);

    return {
      videoId,
      script: scriptText,
      scriptVariant,
    };
  } catch (error) {
    console.error(`[script] Failed to generate script for ${videoId}:`, error);

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "FAILED",
        error: `Script generation failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    });

    throw error;
  }
}
