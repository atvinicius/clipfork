import fal from "@fal-ai/client";
import type {
  AIProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
  VideoGenerationRequest,
  VideoGenerationResult,
  LoRATrainingRequest,
  LoRATrainingResult,
} from "@ugc/shared";
import { uploadToR2 } from "../lib/r2";
import archiver from "archiver";

// ---------------------------------------------------------------------------
// fal.ai provider — implements AIProvider interface
// ---------------------------------------------------------------------------

export class FalProvider implements AIProvider {
  constructor() {
    fal.config({ credentials: process.env.FAL_KEY! });
  }

  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const input: Record<string, unknown> = {
      prompt: req.prompt,
      image_size: { width: req.width, height: req.height },
    };
    if (req.negativePrompt) input.negative_prompt = req.negativePrompt;
    if (req.loraUrl) {
      input.loras = [{ path: req.loraUrl, scale: req.loraScale ?? 0.8 }];
    }

    const result = await fal.subscribe("fal-ai/flux-pro/v1.1", { input });
    const data = result.data as { images: Array<{ url: string }>; seed: number };
    return { url: data.images[0]!.url, seed: data.seed };
  }

  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const duration = Math.min(req.duration, 10);
    const result = await fal.subscribe("fal-ai/kling-video/v3/pro/image-to-video", {
      input: {
        image_url: req.imageUrl,
        prompt: req.prompt,
        duration: String(duration),
        aspect_ratio: req.aspectRatio,
      },
    });
    const data = result.data as { video: { url: string } };
    return { url: data.video.url, duration };
  }

  async trainLoRA(req: LoRATrainingRequest): Promise<LoRATrainingResult> {
    const zipUrl = await this.packageImagesAsZip(req.imageUrls);
    const result = await fal.subscribe("fal-ai/flux-lora-fast-training", {
      input: {
        images_data_url: zipUrl,
        trigger_word: req.triggerWord,
        steps: 1000,
      },
    });
    const data = result.data as { diffusers_lora_file: { url: string } };
    return { loraUrl: data.diffusers_lora_file.url, triggerWord: req.triggerWord };
  }

  private async packageImagesAsZip(imageUrls: string[]): Promise<string> {
    const archive = archiver("zip", { zlib: { level: 5 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));

    for (let i = 0; i < imageUrls.length; i++) {
      const response = await fetch(imageUrls[i]!);
      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = imageUrls[i]!.split(".").pop()?.split("?")[0] ?? "jpg";
      archive.append(buffer, { name: `image-${i}.${ext}` });
    }

    await archive.finalize();
    const zipBuffer = Buffer.concat(chunks);

    const key = `lora-training/${Date.now()}/training-images.zip`;
    const url = await uploadToR2(key, zipBuffer, "application/zip");
    return url;
  }
}
