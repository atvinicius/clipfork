import { prisma } from "@ugc/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComposerJobData {
  videoId: string;
  audioUrls: string[];
  avatarVideoUrl: string | null;
  productImages: string[];
  script: {
    type: "TALKING_HEAD" | "FACELESS" | "CLONED";
    scenes?: Array<{
      type: string;
      text?: string;
      voiceover?: string;
      text_overlay?: string;
      duration_s: number;
      transition?: string;
    }>;
    hook?: {
      type: string;
      text: string;
      duration_s: number;
    };
    cta?: {
      type: string;
      text: string;
      duration_s: number;
    };
  };
}

interface CompositionConfig {
  videoId: string;
  format: {
    width: number;
    height: number;
    fps: number;
    aspect: string;
  };
  totalDuration: number;
  scenes: Array<{
    index: number;
    type: string;
    duration_s: number;
    audioUrl: string | null;
    avatarVideoUrl: string | null;
    productImageUrl: string | null;
    textOverlay: string | null;
    transition: string;
  }>;
  outputKey: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateTotalDuration(script: ComposerJobData["script"]): number {
  let total = 0;

  if (script.hook) {
    total += script.hook.duration_s;
  }

  if (script.scenes) {
    for (const scene of script.scenes) {
      total += scene.duration_s;
    }
  }

  if (script.cta) {
    total += script.cta.duration_s;
  }

  return total;
}

function buildCompositionConfig(
  data: ComposerJobData,
  totalDuration: number
): CompositionConfig {
  const allScenes: ComposerJobData["script"]["scenes"] = [];

  // Flatten hook + scenes + cta into a single ordered list
  if (data.script.hook) {
    allScenes.push({
      type: data.script.hook.type,
      text: data.script.hook.text,
      duration_s: data.script.hook.duration_s,
      transition: "cut",
    });
  }

  if (data.script.scenes) {
    allScenes.push(...data.script.scenes);
  }

  if (data.script.cta) {
    allScenes.push({
      type: data.script.cta.type,
      text: data.script.cta.text,
      duration_s: data.script.cta.duration_s,
      transition: "fade",
    });
  }

  const compositionScenes = (allScenes ?? []).map((scene, index) => ({
    index,
    type: scene.type,
    duration_s: scene.duration_s,
    audioUrl: data.audioUrls[index] ?? null,
    avatarVideoUrl: data.avatarVideoUrl,
    productImageUrl: data.productImages[index] ?? data.productImages[0] ?? null,
    textOverlay: scene.text_overlay ?? scene.text ?? scene.voiceover ?? null,
    transition: scene.transition ?? "cut",
  }));

  return {
    videoId: data.videoId,
    format: {
      width: 1080,
      height: 1920,
      fps: 30,
      aspect: "9:16",
    },
    totalDuration,
    scenes: compositionScenes,
    outputKey: `videos/${data.videoId}/final.mp4`,
  };
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processComposerJob(job: { data: ComposerJobData }) {
  const { videoId } = job.data;

  console.log(`[composer] Starting composition for video ${videoId}`);

  try {
    // Update video status
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "COMPOSING" },
    });

    // Calculate total duration from script
    const totalDuration = calculateTotalDuration(job.data.script);

    // Build composition config
    const compositionConfig = buildCompositionConfig(job.data, totalDuration);

    console.log(
      `[composer] Composition config built: ${compositionConfig.scenes.length} scenes, ${totalDuration}s total`
    );

    // ---------------------------------------------------------------------------
    // MVP Placeholder: In production, this would render with Remotion.
    // For now, we assemble metadata and mark the video as complete.
    // ---------------------------------------------------------------------------

    console.log(
      `[composer] Composition would render here with Remotion (${compositionConfig.format.width}x${compositionConfig.format.height} @ ${compositionConfig.format.fps}fps)`
    );
    console.log(
      `[composer] Output would be uploaded to: ${compositionConfig.outputKey}`
    );

    // Generate a placeholder URL — in production this would be the R2 URL of the rendered video
    const placeholderUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/${compositionConfig.outputKey}`
      : compositionConfig.outputKey;

    // Update Video record to COMPLETED
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "COMPLETED",
        finalVideoUrl: placeholderUrl,
        duration: totalDuration,
      },
    });

    console.log(`[composer] Video ${videoId} marked as COMPLETED`);

    return {
      videoId,
      finalVideoUrl: placeholderUrl,
      duration: totalDuration,
      compositionConfig,
    };
  } catch (error) {
    console.error(`[composer] Failed to compose video ${videoId}:`, error);

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "FAILED",
        error: `Composition failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    });

    throw error;
  }
}
