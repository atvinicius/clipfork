// ---------------------------------------------------------------------------
// AI Provider abstraction — wraps image gen, video gen, and LoRA training
// ---------------------------------------------------------------------------

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  loraUrl?: string;
  loraScale?: number;
}

export interface ImageGenerationResult {
  url: string;
  seed: number;
}

export interface VideoGenerationRequest {
  imageUrl: string;
  prompt: string;
  duration: number;
  aspectRatio: "9:16" | "16:9" | "1:1";
}

export interface VideoGenerationResult {
  url: string;
  duration: number;
}

export interface LoRATrainingRequest {
  imageUrls: string[];
  triggerWord: string;
}

export interface LoRATrainingResult {
  loraUrl: string;
  triggerWord: string;
}

export interface AIProvider {
  generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult>;
  generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult>;
  trainLoRA(req: LoRATrainingRequest): Promise<LoRATrainingResult>;
}
