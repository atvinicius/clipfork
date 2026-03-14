import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";

const connection = createRedisConnection();

export const videoQueue = new Queue("video", { connection });
export const cloneQueue = new Queue("clone", { connection });
export const monitorQueue = new Queue("monitor", { connection });
export const publishQueue = new Queue("publish", { connection });

export const QUEUE_NAMES = {
  VIDEO: "video",
  CLONE: "clone",
  MONITOR: "monitor",
  PUBLISH: "publish",
} as const;
