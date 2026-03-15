import { prisma } from "@ugc/db";
import { FalProvider } from "../providers/fal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoRATrainingJobData {
  brandKitId: string;
  orgId: string;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processLoRATrainingJob(job: { data: LoRATrainingJobData }) {
  const { brandKitId, orgId } = job.data;

  console.log(`[lora-trainer] Starting LoRA training for brand kit ${brandKitId}`);

  try {
    const brandKit = await prisma.brandKit.findFirstOrThrow({
      where: { id: brandKitId, orgId },
    });

    const imageUrls = (brandKit.loraTrainingImages ?? []) as string[];

    if (imageUrls.length < 4) {
      throw new Error(`Need at least 4 training images, got ${imageUrls.length}`);
    }

    await prisma.brandKit.update({
      where: { id: brandKitId },
      data: { loraTrainingStatus: "training" },
    });

    const provider = new FalProvider();
    const triggerWord = `${brandKit.name.toLowerCase().replace(/\s+/g, "_")}_style`;

    const result = await provider.trainLoRA({
      imageUrls,
      triggerWord,
    });

    await prisma.brandKit.update({
      where: { id: brandKitId },
      data: {
        loraUrl: result.loraUrl,
        loraTriggerWord: result.triggerWord,
        loraTrainingStatus: "ready",
      },
    });

    console.log(`[lora-trainer] LoRA training complete for brand kit ${brandKitId}`);

    return { brandKitId, loraUrl: result.loraUrl };
  } catch (error) {
    console.error(`[lora-trainer] LoRA training failed for brand kit ${brandKitId}:`, error);

    await prisma.brandKit.update({
      where: { id: brandKitId },
      data: {
        loraTrainingStatus: "failed",
      },
    });

    throw error;
  }
}
