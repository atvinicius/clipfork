import { Worker, Queue, type ConnectionOptions } from "bullmq";
import { createRedisConnection } from "./connection";
import { processScraperJob } from "./processors/scraper";
import { processScriptJob } from "./processors/script-generator";
import { processTTSJob } from "./processors/tts";
import { processAvatarJob } from "./processors/avatar";
import { processComposerJob } from "./processors/composer";
import { handlePipelineFailure, closePipeline } from "./processors/pipeline";
import { processVideoDownloaderJob } from "./processors/video-downloader";
import { processCloneAnalyzerJob } from "./processors/clone-analyzer";
import { closeClonePipeline } from "./processors/clone-pipeline";
import { processMonitorJob } from "./processors/monitor";
import { processPublishJob } from "./processors/publisher";
import { processSchedulerJob } from "./processors/scheduler";

async function main() {
  const redis = createRedisConnection();
  const connection = redis as unknown as ConnectionOptions;

  console.log("Workers starting...");

  // -------------------------------------------------------------------
  // Register workers with concurrency settings
  // -------------------------------------------------------------------

  const scraperWorker = new Worker("scraper", processScraperJob, {
    connection,
    concurrency: 5,
  });

  const scriptWorker = new Worker("script", processScriptJob, {
    connection,
    concurrency: 3,
  });

  const ttsWorker = new Worker("tts", processTTSJob, {
    connection,
    concurrency: 5,
  });

  const avatarWorker = new Worker("avatar", processAvatarJob, {
    connection,
    concurrency: 3,
  });

  const composerWorker = new Worker("composer", processComposerJob, {
    connection,
    concurrency: 2,
  });

  const videoDownloaderWorker = new Worker(
    "clone-download",
    processVideoDownloaderJob,
    { connection, concurrency: 3 }
  );

  const cloneAnalyzerWorker = new Worker(
    "clone-analyze",
    processCloneAnalyzerJob,
    { connection, concurrency: 2 }
  );

  const monitorWorker = new Worker("monitor", processMonitorJob, {
    connection,
    concurrency: 2,
  });

  const publisherWorker = new Worker("publish", processPublishJob, {
    connection,
    concurrency: 2,
  });

  const schedulerWorker = new Worker("scheduler", processSchedulerJob, {
    connection,
    concurrency: 1,
  });

  const workers = [
    scraperWorker,
    scriptWorker,
    ttsWorker,
    avatarWorker,
    composerWorker,
    videoDownloaderWorker,
    cloneAnalyzerWorker,
    monitorWorker,
    publisherWorker,
    schedulerWorker,
  ];

  // -------------------------------------------------------------------
  // Set up scheduler repeatable job (every minute)
  // -------------------------------------------------------------------

  const schedulerQueue = new Queue("scheduler", { connection });
  await schedulerQueue.upsertJobScheduler(
    "scheduler-cron",
    { pattern: "* * * * *" },
    {
      name: "scheduled-publish-check",
      data: { _trigger: "cron" as const },
    }
  );

  console.log("Scheduler repeatable job registered (every minute)");

  // -------------------------------------------------------------------
  // Error & failure event handlers
  // -------------------------------------------------------------------

  for (const worker of workers) {
    worker.on("completed", (job) => {
      console.log(`[${worker.name}] Job ${job.id} completed`);
    });

    worker.on("failed", async (job, err) => {
      console.error(`[${worker.name}] Job ${job?.id} failed:`, err.message);

      // Attempt pipeline-level failure handling for video pipeline jobs
      const data = job?.data as Record<string, unknown> | undefined;
      const videoId =
        (data?.videoId as string | undefined) ??
        job?.name?.split("-").slice(1).join("-");
      if (
        videoId &&
        ["scraper", "script", "tts", "avatar", "composer"].includes(
          worker.name
        )
      ) {
        await handlePipelineFailure(videoId, err);
      }
    });

    worker.on("error", (err) => {
      console.error(`[${worker.name}] Worker error:`, err.message);
    });
  }

  console.log("Workers registered:");
  console.log("  - scraper          (concurrency: 5)");
  console.log("  - script           (concurrency: 3)");
  console.log("  - tts              (concurrency: 5)");
  console.log("  - avatar           (concurrency: 3)");
  console.log("  - composer         (concurrency: 2)");
  console.log("  - clone-download   (concurrency: 3)");
  console.log("  - clone-analyze    (concurrency: 2)");
  console.log("  - monitor          (concurrency: 2)");
  console.log("  - publish          (concurrency: 2)");
  console.log("  - scheduler        (concurrency: 1, cron: every minute)");
  console.log("Workers ready and listening for jobs...");

  // -------------------------------------------------------------------
  // Graceful shutdown
  // -------------------------------------------------------------------

  const shutdown = async () => {
    console.log("Shutting down workers...");

    await Promise.all(workers.map((w) => w.close()));
    await schedulerQueue.close();
    await closePipeline();
    await closeClonePipeline();
    await redis.quit();

    console.log("All workers shut down.");
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch(console.error);
