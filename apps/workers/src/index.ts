import { Worker, type ConnectionOptions } from "bullmq";
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

  const workers = [
    scraperWorker,
    scriptWorker,
    ttsWorker,
    avatarWorker,
    composerWorker,
    videoDownloaderWorker,
    cloneAnalyzerWorker,
  ];

  // -------------------------------------------------------------------
  // Error & failure event handlers
  // -------------------------------------------------------------------

  for (const worker of workers) {
    worker.on("completed", (job) => {
      console.log(`[${worker.name}] Job ${job.id} completed`);
    });

    worker.on("failed", async (job, err) => {
      console.error(`[${worker.name}] Job ${job?.id} failed:`, err.message);

      // Attempt pipeline-level failure handling for video jobs
      const data = job?.data as Record<string, unknown> | undefined;
      const videoId =
        (data?.videoId as string | undefined) ??
        job?.name?.split("-").slice(1).join("-");
      if (videoId) {
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
  console.log("Workers ready and listening for jobs...");

  // -------------------------------------------------------------------
  // Graceful shutdown
  // -------------------------------------------------------------------

  const shutdown = async () => {
    console.log("Shutting down workers...");

    await Promise.all(workers.map((w) => w.close()));
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
