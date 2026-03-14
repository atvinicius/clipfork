import { FlowProducer, type ConnectionOptions } from "bullmq";
import { prisma } from "@ugc/db";
import {
  calculateVideoCredits,
  calculateClonedVideoCredits,
} from "@ugc/shared";
import { createRedisConnection } from "../connection";
import type { ScraperJobData } from "./scraper";
import type { ScriptJobData } from "./script-generator";
import type { TTSJobData } from "./tts";
import type { AvatarJobData } from "./avatar";
import type { ComposerJobData } from "./composer";

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
  avatarId?: string;
  brandKitId?: string;
  templateId?: string;
}

// ---------------------------------------------------------------------------
// Flow producer singleton
// ---------------------------------------------------------------------------

let flowProducer: FlowProducer | null = null;

function getFlowProducer(): FlowProducer {
  if (!flowProducer) {
    const connection = createRedisConnection() as unknown as ConnectionOptions;
    flowProducer = new FlowProducer({ connection });
  }
  return flowProducer;
}

// ---------------------------------------------------------------------------
// Credit calculation
// ---------------------------------------------------------------------------

async function calculateCreditsForVideo(
  videoType: "TALKING_HEAD" | "FACELESS" | "CLONED",
  templateId?: string
): Promise<number> {
  if (videoType === "CLONED" && templateId) {
    // For cloned videos, we need the template structure to calculate credits
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
        scenes.map((s) => ({
          type: s.type as
            | "talking_head"
            | "product_broll"
            | "text_overlay"
            | "testimonial"
            | "greenscreen",
        }))
      );
    }
  }

  // Default: estimate based on a 15-second video
  return calculateVideoCredits(videoType, 15);
}

// ---------------------------------------------------------------------------
// Start pipeline
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
    avatarId,
    brandKitId,
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

  // Deduct credits atomically
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

  // 2. Fetch brand kit if specified
  let brandKit: ScriptJobData["brandKit"] = null;
  if (brandKitId) {
    const bk = await prisma.brandKit.findUnique({
      where: { id: brandKitId },
    });
    if (bk) {
      brandKit = {
        toneOfVoice: bk.toneOfVoice,
        targetAudience: bk.targetAudience,
        colors: bk.colors as Record<string, string>,
      };
    }
  }

  // 3. Fetch template structure if specified
  let templateStructure: ScriptJobData["templateStructure"] = null;
  if (templateId) {
    const template = await prisma.template.findUnique({
      where: { id: templateId },
    });
    if (template) {
      templateStructure =
        template.structure as ScriptJobData["templateStructure"];
    }
  }

  // 4. Create the BullMQ flow
  // Pipeline: scrape -> script -> [tts + avatar] -> compose
  //
  // BullMQ FlowProducer creates a DAG where children must complete before
  // the parent job starts. We model the pipeline bottom-up:
  //
  //   compose (root)
  //     <- avatar (depends on tts completing)
  //     <- tts (depends on script completing)
  //       <- script (depends on scrape completing)
  //         <- scrape (leaf)

  const flow = getFlowProducer();

  const scraperData: ScraperJobData = {
    productUrl,
    productId,
    orgId,
  };

  // We pass placeholder data that will be enriched by the pipeline event
  // handlers. BullMQ FlowProducer does not natively support passing results
  // between jobs — the workers themselves read from DB and pass data forward.
  const scriptData: ScriptJobData = {
    videoId,
    productData: {
      title: "",
      description: "",
      images: [],
      price: null,
      reviews: [],
    },
    videoType,
    brandKit,
    templateStructure,
  };

  const ttsData: TTSJobData = {
    videoId,
    scenes: [],
    voiceId,
  };

  const avatarData: AvatarJobData = {
    videoId,
    script: "",
    audioUrl: "",
    avatarId: avatarId ?? "",
    videoType,
  };

  const composerData: ComposerJobData = {
    videoId,
    audioUrls: [],
    avatarVideoUrl: null,
    productImages: [],
    script: { type: videoType },
  };

  const jobTree = await flow.add({
    name: `compose-${videoId}`,
    queueName: "composer",
    data: composerData,
    children: [
      {
        name: `avatar-${videoId}`,
        queueName: "avatar",
        data: avatarData,
        children: [
          {
            name: `tts-${videoId}`,
            queueName: "tts",
            data: ttsData,
            children: [
              {
                name: `script-${videoId}`,
                queueName: "script",
                data: scriptData,
                children: [
                  {
                    name: `scrape-${videoId}`,
                    queueName: "scraper",
                    data: scraperData,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });

  console.log(`[pipeline] Flow created for video ${videoId}`);

  return jobTree.job.id ?? videoId;
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
    // Get the video to find org and credits used
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      console.error(`[pipeline] Video ${videoId} not found for refund`);
      return;
    }

    if (video.creditsUsed > 0) {
      // Refund credits
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

    // Update video status
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

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export async function closePipeline(): Promise<void> {
  if (flowProducer) {
    await flowProducer.close();
    flowProducer = null;
  }
}
