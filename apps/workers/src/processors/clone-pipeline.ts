import { FlowProducer, type ConnectionOptions } from "bullmq";
import { prisma } from "@ugc/db";
import { calculateClonedVideoCredits } from "@ugc/shared";
import { createRedisConnection } from "../connection";
import type { ScriptJobData } from "./script-generator";
import type { TTSJobData } from "./tts";
import type { AvatarJobData } from "./avatar";
import type { ComposerJobData } from "./composer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClonePipelineAnalyzeOptions {
  url: string;
  orgId: string;
}

export interface ClonePipelineGenerateOptions {
  videoId: string;
  templateId: string;
  productId: string;
  productUrl?: string;
  orgId: string;
  voiceId: string;
  avatarId?: string;
  brandKitId?: string;
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
// Start clone generation pipeline
// ---------------------------------------------------------------------------

export async function startCloneGenerationPipeline(
  opts: ClonePipelineGenerateOptions
): Promise<string> {
  const {
    videoId,
    templateId,
    productId,
    productUrl,
    orgId,
    voiceId,
    avatarId,
    brandKitId,
  } = opts;

  console.log(
    `[clone-pipeline] Starting generation pipeline for video ${videoId}`
  );

  // 1. Calculate credits from template structure
  const template = await prisma.template.findUniqueOrThrow({
    where: { id: templateId },
  });

  const structure = template.structure as {
    structure?: {
      scenes?: Array<{ type: string }>;
    };
  };
  const scenes = structure.structure?.scenes ?? [];
  const creditCost = calculateClonedVideoCredits(
    scenes.map((s) => ({
      type: s.type as
        | "talking_head"
        | "product_broll"
        | "text_overlay"
        | "testimonial"
        | "greenscreen",
    }))
  );

  // 2. Check and deduct credits
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
    `[clone-pipeline] Deducted ${creditCost} credits from org ${orgId}`
  );

  // 3. Fetch brand kit if specified
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

  // 4. Get template structure for script generation
  const templateStructure =
    template.structure as ScriptJobData["templateStructure"];

  // 5. Determine if we have talking_head scenes (need avatar)
  const hasTalkingHead = scenes.some((s) => s.type === "talking_head");
  const videoType = "CLONED" as const;

  // 6. Build the BullMQ flow
  // Pipeline: scrape -> script -> tts -> avatar -> compose
  const flow = getFlowProducer();

  const scraperData = {
    productUrl: productUrl ?? "",
    productId,
    orgId,
  };

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
    avatarVideoUrl: hasTalkingHead ? null : null,
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

  console.log(
    `[clone-pipeline] Generation flow created for video ${videoId}`
  );

  return jobTree.job.id ?? videoId;
}

// ---------------------------------------------------------------------------
// Start batch clone generation
// ---------------------------------------------------------------------------

export async function startBatchCloneGeneration(
  variants: ClonePipelineGenerateOptions[]
): Promise<string[]> {
  const jobIds: string[] = [];

  for (const variant of variants) {
    const jobId = await startCloneGenerationPipeline(variant);
    jobIds.push(jobId);
  }

  console.log(
    `[clone-pipeline] Batch generation started: ${jobIds.length} variants`
  );

  return jobIds;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export async function closeClonePipeline(): Promise<void> {
  if (flowProducer) {
    await flowProducer.close();
    flowProducer = null;
  }
}
