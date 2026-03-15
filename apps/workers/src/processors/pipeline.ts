import { prisma } from "@ugc/db";
import {
  calculateVideoCredits,
  calculateClonedVideoCredits,
} from "@ugc/shared";
import { sendJob, QUEUE_NAMES } from "../queues";
import type { ScriptJobData } from "./script-generator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineOptions {
  videoId: string;
  productUrl: string;
  productId: string;
  orgId: string;
  videoType: "TALKING_HEAD" | "FACELESS" | "CLONED";
  voiceId: string;
  brandKitId?: string;
  presetId?: string;
  templateId?: string;
}

// ---------------------------------------------------------------------------
// Credit calculation
// ---------------------------------------------------------------------------

async function calculateCreditsForVideo(
  videoType: "TALKING_HEAD" | "FACELESS" | "CLONED",
  templateId?: string
): Promise<number> {
  if (videoType === "CLONED" && templateId) {
    const template = await prisma.template.findUnique({
      where: { id: templateId },
    });

    if (template && template.structure) {
      const structure = template.structure as {
        structure?: {
          scenes?: Array<{ type: string }>;
        };
      };
      const scenes = structure.structure?.scenes ?? [];
      return calculateClonedVideoCredits(
        scenes.map((s) => ({ type: s.type }))
      );
    }
  }

  // Default: 5 scenes for a standard video
  return calculateVideoCredits(5);
}

// ---------------------------------------------------------------------------
// Start pipeline — deducts credits, sends first job (scraper)
// ---------------------------------------------------------------------------

export async function startVideoPipeline(
  opts: PipelineOptions
): Promise<string> {
  const {
    videoId,
    productUrl,
    productId,
    orgId,
    videoType,
    voiceId,
    brandKitId,
    presetId,
    templateId,
  } = opts;

  console.log(`[pipeline] Starting pipeline for video ${videoId}`);

  // 1. Calculate and deduct credits
  const creditCost = await calculateCreditsForVideo(videoType, templateId);

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
  });

  if (org.creditsBalance < creditCost) {
    throw new Error(
      `Insufficient credits: need ${creditCost}, have ${org.creditsBalance}`
    );
  }

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: orgId },
      data: { creditsBalance: { decrement: creditCost } },
    }),
    prisma.creditTransaction.create({
      data: {
        orgId,
        amount: -creditCost,
        type: "USAGE",
        referenceId: videoId,
      },
    }),
    prisma.video.update({
      where: { id: videoId },
      data: {
        status: "SCRAPING",
        creditsUsed: creditCost,
      },
    }),
  ]);

  console.log(
    `[pipeline] Deducted ${creditCost} credits from org ${orgId} (balance: ${org.creditsBalance - creditCost})`
  );

  // 2. Fetch brand kit if specified (needed by script-generator via job data)
  let brandKit: ScriptJobData["brandKit"] = null;
  if (brandKitId) {
    const bk = await prisma.brandKit.findUnique({ where: { id: brandKitId } });
    if (bk) {
      brandKit = {
        toneOfVoice: bk.toneOfVoice,
        targetAudience: bk.targetAudience,
        colors: bk.colors as Record<string, string>,
      };
    }
  }

  // 3. Fetch template structure if specified (needed by script-generator via job data)
  let templateStructure: ScriptJobData["templateStructure"] = null;
  if (templateId) {
    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (template) {
      templateStructure = template.structure as ScriptJobData["templateStructure"];
    }
  }

  // 4. Send the first pipeline job (scraper) with pipeline metadata
  const jobId = await sendJob(QUEUE_NAMES.SCRAPER, {
    productUrl,
    productId,
    orgId,
    _pipeline: {
      videoId,
      productUrl,
      productId,
      orgId,
      videoType,
      voiceId,
      brandKitId,
      presetId,
      templateId,
      brandKit,
      templateStructure,
    },
  });

  console.log(`[pipeline] First job sent for video ${videoId}`);

  return jobId ?? videoId;
}

// ---------------------------------------------------------------------------
// Handle pipeline failure — refund credits
// ---------------------------------------------------------------------------

export async function handlePipelineFailure(
  videoId: string,
  error: Error | string
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;

  console.error(`[pipeline] Pipeline failed for video ${videoId}: ${errorMessage}`);

  try {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      console.error(`[pipeline] Video ${videoId} not found for refund`);
      return;
    }

    if (video.creditsUsed > 0) {
      await prisma.$transaction([
        prisma.organization.update({
          where: { id: video.orgId },
          data: { creditsBalance: { increment: video.creditsUsed } },
        }),
        prisma.creditTransaction.create({
          data: {
            orgId: video.orgId,
            amount: video.creditsUsed,
            type: "REFUND",
            referenceId: videoId,
          },
        }),
      ]);

      console.log(
        `[pipeline] Refunded ${video.creditsUsed} credits to org ${video.orgId}`
      );
    }

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "FAILED",
        error: errorMessage,
      },
    });
  } catch (refundError) {
    console.error(
      `[pipeline] Failed to handle pipeline failure for ${videoId}:`,
      refundError
    );
  }
}
