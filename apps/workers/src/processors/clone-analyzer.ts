import OpenAI from "openai";
import { prisma } from "@ugc/db";
import { templateStructureSchema } from "@ugc/shared";
import { getPresignedUrl } from "../lib/r2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CloneAnalyzerJobData {
  videoUrl: string;
  videoKey: string;
  sourceUrl: string;
  orgId: string;
}

export interface CloneAnalyzerResult {
  templateId: string;
  structure: unknown;
}

// ---------------------------------------------------------------------------
// OpenRouter client
// ---------------------------------------------------------------------------

function getOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });
}

// ---------------------------------------------------------------------------
// Analysis prompt
// ---------------------------------------------------------------------------

const ANALYSIS_SYSTEM_PROMPT = `You are a viral video structure analyst. Your job is to watch a short-form video (TikTok, Reels, Shorts) and break down its exact structure into a JSON template.

Analyze the video and output a JSON structure with the following schema:

{
  "structure": {
    "hook": {
      "type": "question" | "story" | "shock" | "statistic",
      "duration_s": <number>,
      "text_overlay": <boolean>
    },
    "scenes": [
      {
        "type": "talking_head" | "product_broll" | "text_overlay" | "testimonial" | "greenscreen",
        "duration_s": <number>,
        "emotion": "<string describing the emotion>",
        "gesture": "<string describing physical gesture>",
        "transition": "<string describing transition to next scene>",
        "text_overlay": "<text shown on screen or false if none>"
      }
    ],
    "cta": {
      "type": "urgency" | "scarcity" | "social_proof",
      "duration_s": <number>,
      "text_overlay": <boolean>
    }
  },
  "style": {
    "pacing": "slow" | "medium" | "fast",
    "music_mood": "<string>",
    "caption_style": "<string describing caption styling>",
    "color_tone": "<string describing color grading>"
  },
  "format": {
    "aspect": "9:16",
    "total_duration_s": <number>
  }
}

Rules:
- Be precise about scene durations (to 0.5s accuracy)
- Identify ALL distinct scenes in the video
- Classify the hook type based on what strategy is used to grab attention
- Classify the CTA type based on the persuasion technique used
- For pacing: slow = lots of pauses, medium = natural flow, fast = rapid cuts
- Output ONLY valid JSON, no explanations or markdown
- Every scene must have a type, duration_s, emotion, gesture, and transition`;

// ---------------------------------------------------------------------------
// Detect source platform
// ---------------------------------------------------------------------------

function detectPlatform(
  url: string
): "TIKTOK" | "INSTAGRAM" | "YOUTUBE" | null {
  const lower = url.toLowerCase();
  if (lower.includes("tiktok.com") || lower.includes("vm.tiktok")) {
    return "TIKTOK";
  }
  if (lower.includes("instagram.com") || lower.includes("instagr.am")) {
    return "INSTAGRAM";
  }
  if (
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    lower.includes("shorts")
  ) {
    return "YOUTUBE";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parse JSON from response
// ---------------------------------------------------------------------------

function parseJsonFromResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // noop
  }

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]!.trim());
    } catch {
      // noop
    }
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.substring(start, end + 1));
    } catch {
      // noop
    }
  }

  throw new Error("Could not parse JSON from response");
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processCloneAnalyzerJob(
  job: { data: CloneAnalyzerJobData }
): Promise<CloneAnalyzerResult> {
  const { videoKey, sourceUrl, orgId } = job.data;

  console.log(
    `[clone-analyzer] Starting analysis for video: ${videoKey}`
  );

  // 1. Download video from R2 as buffer
  const presignedUrl = await getPresignedUrl(videoKey);
  const videoResponse = await fetch(presignedUrl);

  if (!videoResponse.ok) {
    throw new Error(
      `Failed to download video from R2: ${videoResponse.status}`
    );
  }

  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
  console.log(
    `[clone-analyzer] Downloaded video (${videoBuffer.length} bytes)`
  );

  // 2. Analyze with Gemini 2.5 Flash via OpenRouter
  const client = getOpenRouterClient();
  const videoBase64 = videoBuffer.toString("base64");

  const result = await client.chat.completions.create({
    model: "google/gemini-2.5-flash",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: ANALYSIS_SYSTEM_PROMPT,
          },
          {
            // @ts-expect-error -- OpenRouter supports video_url but openai SDK types don't include it
            type: "video_url",
            video_url: {
              url: `data:video/mp4;base64,${videoBase64}`,
            },
          },
        ],
      },
    ],
  });

  const responseText = result.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error("No text content in Gemini response");
  }
  console.log(`[clone-analyzer] Gemini response received`);

  // 3. Parse and validate the structure
  const parsed = parseJsonFromResponse(responseText);
  const validated = templateStructureSchema.parse(parsed);

  console.log(
    `[clone-analyzer] Structure validated: ${validated.structure.scenes.length} scenes, ${validated.format.total_duration_s}s total`
  );

  // 4. Detect platform
  const platform = detectPlatform(sourceUrl);

  // 5. Create Template record in DB
  const template = await prisma.template.create({
    data: {
      orgId,
      sourceUrl,
      sourcePlatform: platform,
      structure: validated as unknown as object,
      category: validated.structure.hook.type,
      industry: [],
      engagementScore: null,
      isPublic: false,
    },
  });

  console.log(
    `[clone-analyzer] Template created: ${template.id}`
  );

  return {
    templateId: template.id,
    structure: validated,
  };
}
