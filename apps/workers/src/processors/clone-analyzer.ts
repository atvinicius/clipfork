import { Job } from "bullmq";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
// Gemini client
// ---------------------------------------------------------------------------

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured");
  }
  return new GoogleGenerativeAI(apiKey);
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
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // noop
  }

  // Try extracting from markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]!.trim());
    } catch {
      // noop
    }
  }

  // Try finding first { and last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.substring(start, end + 1));
    } catch {
      // noop
    }
  }

  throw new Error("Could not parse JSON from Gemini response");
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processCloneAnalyzerJob(
  job: Job<CloneAnalyzerJobData>
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

  // 2. Analyze with Gemini 2.5 Flash
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const videoBase64 = videoBuffer.toString("base64");

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "video/mp4",
        data: videoBase64,
      },
    },
    { text: ANALYSIS_SYSTEM_PROMPT },
  ]);

  const responseText = result.response.text();
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
      structure: validated as unknown as Record<string, unknown>,
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
