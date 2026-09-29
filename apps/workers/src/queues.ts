import { getBoss } from "./boss";

export const QUEUE_NAMES = {
  SCRAPER: "scraper",
  SCRIPT: "script",
  TTS: "tts",
  SCENE_GENERATOR: "scene-generator",
  VIDEO_ASSEMBLER: "video-assembler",
  LORA_TRAINING: "lora-training",
  CLONE_DOWNLOAD: "clone-download",
  CLONE_ANALYZE: "clone-analyze",
  MONITOR: "monitor",
  PUBLISH: "publish",
  SCHEDULER: "scheduler",
  CLONE: "clone",
  INTEL_DISPATCH: "intel-dispatch",
  INTEL_COLLECT: "intel-collect",
  INTEL_DOWNLOAD: "intel-download",
  INTEL_SIGNALS: "intel-signals",
} as const;

export async function sendJob(
  queue: string,
  data: object,
  options?: {
    priority?: number;
    retryLimit?: number;
    startAfter?: number;
    singletonKey?: string;
  }
): Promise<string | null> {
  const boss = getBoss();
  return boss.send(queue, data, options);
}
