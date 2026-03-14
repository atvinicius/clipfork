import { prisma } from "@ugc/db";
import { calculateClonedVideoCredits } from "@ugc/shared";
import { sendJob, QUEUE_NAMES } from "../queues";
import type { ScriptJobData } from "./script-generator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

  // 5. Send first pipeline job (scraper) with pipeline metadata
  const jobId = await sendJob(QUEUE_NAMES.SCRAPER, {
    productUrl: productUrl ?? "",
    productId,
    orgId,
    _pipeline: {
      videoId,
      productUrl: productUrl ?? "",
      productId,
      orgId,
      videoType: "CLONED" as const,
      voiceId,
      avatarId,
      brandKitId,
      templateId,
      brandKit,
      templateStructure,
    },
  });

  console.log(
    `[clone-pipeline] First job sent for video ${videoId}`
  );

  return jobId ?? videoId;
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
