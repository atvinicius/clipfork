import { prisma } from "@ugc/db";
import { FalProvider } from "../providers/fal";
import { uploadToR2 } from "../lib/r2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NormalizedScene {
  type: string;
  visualDescription: string;
  captionText: string;
  duration_s: number;
  emotion?: string;
}

export interface SceneGeneratorJobData {
  videoId: string;
}

interface PromptContext {
  sceneStyles: Record<string, string>;
  productName: string;
  loraTriggerWord?: string;
}

// ---------------------------------------------------------------------------
// Default scene-type visual strategies (used when no preset match)
// ---------------------------------------------------------------------------

const DEFAULT_SCENE_STYLES: Record<string, string> = {
  hook: "bold pattern-interrupt visual, dramatic close-up, eye-catching",
  benefit: "product in use showing value proposition, soft natural lighting",
  demo: "product interaction step-by-step, clean background",
  testimonial: "authentic candid feel, warm lighting, genuine expression",
  cta: "product arrangement, call-to-action composition, inviting",
};

// ---------------------------------------------------------------------------
// Scene normalization
// ---------------------------------------------------------------------------

export function normalizeScenes(
  videoType: "TALKING_HEAD" | "FACELESS" | "CLONED",
  scriptVariant: Record<string, unknown>
): NormalizedScene[] {
  switch (videoType) {
    case "TALKING_HEAD":
      return normalizeTalkingHead(scriptVariant);
    case "FACELESS":
      return normalizeFaceless(scriptVariant);
    case "CLONED":
      return normalizeCloned(scriptVariant);
    default:
      return normalizeFaceless(scriptVariant);
  }
}

function normalizeTalkingHead(sv: Record<string, unknown>): NormalizedScene[] {
  const scenes = (sv.scenes ?? []) as Array<{
    type: string;
    text: string;
    duration_s: number;
    emotion?: string;
  }>;
  return scenes.map((s) => ({
    type: s.type,
    visualDescription: s.text,
    captionText: s.text,
    duration_s: s.duration_s,
    emotion: s.emotion,
  }));
}

function normalizeFaceless(sv: Record<string, unknown>): NormalizedScene[] {
  const scenes = (sv.scenes ?? []) as Array<{
    type: string;
    text_overlay?: string;
    voiceover?: string;
    broll_description?: string;
    duration_s: number;
  }>;
  return scenes.map((s) => ({
    type: s.type,
    visualDescription: s.broll_description ?? s.text_overlay ?? "",
    captionText: s.voiceover ?? s.text_overlay ?? "",
    duration_s: s.duration_s,
    emotion: undefined,
  }));
}

function normalizeCloned(sv: Record<string, unknown>): NormalizedScene[] {
  const result: NormalizedScene[] = [];
  const hook = sv.hook as { type: string; duration_s: number; text_overlay?: string } | undefined;
  const scenes = (sv.scenes ?? []) as Array<{ type: string; duration_s: number; text_overlay?: string; emotion?: string }>;
  const cta = sv.cta as { type: string; duration_s: number; text_overlay?: string } | undefined;

  if (hook) {
    result.push({
      type: hook.type,
      visualDescription: hook.text_overlay ?? "dramatic opening hook",
      captionText: hook.text_overlay ?? "",
      duration_s: hook.duration_s,
    });
  }

  for (const s of scenes) {
    result.push({
      type: s.type,
      visualDescription: s.text_overlay ?? s.type,
      captionText: s.text_overlay ?? "",
      duration_s: s.duration_s,
      emotion: s.emotion,
    });
  }

  if (cta) {
    result.push({
      type: cta.type,
      visualDescription: cta.text_overlay ?? "call to action",
      captionText: cta.text_overlay ?? "",
      duration_s: cta.duration_s,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

export function buildImagePrompt(
  scene: NormalizedScene,
  ctx: PromptContext
): string {
  const parts: string[] = [];

  const sceneStyle = ctx.sceneStyles[scene.type] ?? DEFAULT_SCENE_STYLES[scene.type] ?? "";
  if (sceneStyle) parts.push(sceneStyle);

  if (ctx.productName) parts.push(`featuring ${ctx.productName}`);

  if (ctx.loraTriggerWord) parts.push(`in the style of ${ctx.loraTriggerWord}`);

  if (scene.visualDescription) parts.push(scene.visualDescription);

  parts.push("professional product photography, 4k, sharp focus");

  return parts.join(", ");
}

function buildNegativePrompt(presetNegative?: string): string {
  const base = "blurry, low quality, text, watermark, cartoon, illustration";
  return presetNegative ? `${presetNegative}, ${base}` : base;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processSceneGeneratorJob(job: { data: SceneGeneratorJobData }) {
  const { videoId } = job.data;

  console.log(`[scene-generator] Starting scene generation for video ${videoId}`);

  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
    include: { product: true, brandKit: true, preset: true },
  });

  await prisma.video.update({
    where: { id: videoId },
    data: { status: "GENERATING_SCENES" },
  });

  const scriptVariant = (video.scriptVariant ?? {}) as Record<string, unknown>;
  const videoType = video.type as "TALKING_HEAD" | "FACELESS" | "CLONED";

  const scenes = normalizeScenes(videoType, scriptVariant);

  if (scenes.length === 0) {
    throw new Error("No scenes found in script variant");
  }

  console.log(`[scene-generator] Normalized ${scenes.length} scenes for video ${videoId}`);

  const presetSceneStyles = (video.preset?.sceneStyles as Record<string, string>) ?? {};
  const presetNegative = video.preset?.negativePrompt ?? undefined;
  const productName = video.product?.name ?? "";
  const loraTriggerWord = video.brandKit?.loraTriggerWord ?? undefined;

  const promptCtx: PromptContext = {
    sceneStyles: presetSceneStyles,
    productName,
    loraTriggerWord,
  };

  const provider = new FalProvider();
  const allSceneVideos: string[][] = [];
  const allSceneImages: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]!;
    console.log(`[scene-generator] Processing scene ${i + 1}/${scenes.length} (${scene.type})`);

    const prompt = buildImagePrompt(scene, promptCtx);
    const negativePrompt = buildNegativePrompt(presetNegative);

    const imageResult = await provider.generateImage({
      prompt,
      negativePrompt,
      width: 1080,
      height: 1920,
      loraUrl: video.brandKit?.loraUrl ?? undefined,
      loraScale: 0.8,
    });

    const imgResponse = await fetch(imageResult.url);
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
    const imgKey = `videos/${videoId}/scenes/scene-${i}.jpg`;
    const imgUrl = await uploadToR2(imgKey, imgBuffer, "image/jpeg");
    allSceneImages.push(imgUrl);

    console.log(`[scene-generator] Scene ${i + 1} image generated`);

    const segmentUrls: string[] = [];
    let remainingDuration = scene.duration_s;
    let segmentIndex = 0;
    let currentImageUrl = imageResult.url;

    while (remainingDuration > 0) {
      const segmentDuration = Math.min(remainingDuration, 10);

      let videoResult;
      try {
        videoResult = await provider.generateVideo({
          imageUrl: currentImageUrl,
          prompt: scene.visualDescription,
          duration: segmentDuration,
          aspectRatio: "9:16",
        });
      } catch (err) {
        console.warn(`[scene-generator] Kling V3 failed for scene ${i}, segment ${segmentIndex}, trying Wan 2.2`);
        videoResult = await fallbackVideoGeneration(currentImageUrl, scene.visualDescription, segmentDuration);
      }

      const vidResponse = await fetch(videoResult.url);
      const vidBuffer = Buffer.from(await vidResponse.arrayBuffer());
      const vidKey = `videos/${videoId}/scenes/scene-${i}-part-${segmentIndex}.mp4`;
      const vidUrl = await uploadToR2(vidKey, vidBuffer, "video/mp4");
      segmentUrls.push(vidUrl);

      remainingDuration -= segmentDuration;
      segmentIndex++;
      currentImageUrl = imageResult.url;
    }

    allSceneVideos.push(segmentUrls);
    console.log(`[scene-generator] Scene ${i + 1} video generated (${segmentUrls.length} segments)`);
  }

  await prisma.video.update({
    where: { id: videoId },
    data: {
      sceneVideos: allSceneVideos,
      sceneImages: allSceneImages,
    },
  });

  console.log(`[scene-generator] All scenes generated for video ${videoId}`);

  return { videoId, sceneCount: scenes.length };
}

// ---------------------------------------------------------------------------
// Fallback: Wan 2.2 via fal.ai
// ---------------------------------------------------------------------------

async function fallbackVideoGeneration(
  imageUrl: string,
  prompt: string,
  duration: number
) {
  const fal = (await import("@fal-ai/client")).default;
  const result = await fal.subscribe("fal-ai/wan/v2.2/image-to-video", {
    input: {
      image_url: imageUrl,
      prompt,
      duration: String(Math.min(duration, 5)),
      aspect_ratio: "9:16",
    },
  });
  const data = result.data as { video: { url: string } };
  return { url: data.video.url, duration };
}
