import { Queue, type ConnectionOptions } from "bullmq";
import { createRedisConnection } from "./connection";

const connection = createRedisConnection() as unknown as ConnectionOptions;

export const videoQueue = new Queue("video", { connection });
export const cloneQueue = new Queue("clone", { connection });
export const monitorQueue = new Queue("monitor", { connection });
export const publishQueue = new Queue("publish", { connection });

// Pipeline queues
export const scraperQueue = new Queue("scraper", { connection });
export const scriptQueue = new Queue("script", { connection });
export const ttsQueue = new Queue("tts", { connection });
export const avatarQueue = new Queue("avatar", { connection });
export const composerQueue = new Queue("composer", { connection });

// Clone pipeline queues
export const cloneDownloadQueue = new Queue("clone-download", { connection });
export const cloneAnalyzeQueue = new Queue("clone-analyze", { connection });

export const QUEUE_NAMES = {
  VIDEO: "video",
  CLONE: "clone",
  MONITOR: "monitor",
  PUBLISH: "publish",
  SCRAPER: "scraper",
  SCRIPT: "script",
  TTS: "tts",
  AVATAR: "avatar",
  COMPOSER: "composer",
  CLONE_DOWNLOAD: "clone-download",
  CLONE_ANALYZE: "clone-analyze",
} as const;
