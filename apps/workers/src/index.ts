import { startBoss, stopBoss } from "./boss";
import { QUEUE_NAMES, sendJob } from "./queues";
import { processScraperJob } from "./processors/scraper";
import { processScriptJob } from "./processors/script-generator";
import { processTTSJob } from "./processors/tts";
import { processAvatarJob } from "./processors/avatar";
import { processComposerJob } from "./processors/composer";
import { handlePipelineFailure } from "./processors/pipeline";
import { processVideoDownloaderJob } from "./processors/video-downloader";
import { processCloneAnalyzerJob } from "./processors/clone-analyzer";
import { processMonitorJob } from "./processors/monitor";
import { processPublishJob } from "./processors/publisher";
import { processSchedulerJob } from "./processors/scheduler";
import type { ScriptJobData } from "./processors/script-generator";
import type { TTSJobData } from "./processors/tts";
import type { AvatarJobData } from "./processors/avatar";
import type { ComposerJobData } from "./processors/composer";

// ---------------------------------------------------------------------------
// Pipeline step definitions for job chaining
// ---------------------------------------------------------------------------

interface PipelineMeta {
  videoId: string;
  productUrl: string;
  productId: string;
  orgId: string;
  videoType: "TALKING_HEAD" | "FACELESS" | "CLONED";
  voiceId: string;
  avatarId?: string;
  brandKitId?: string;
  templateId?: string;
  brandKit: ScriptJobData["brandKit"];
  templateStructure: ScriptJobData["templateStructure"];
}

async function chainNextPipelineStep(
  currentQueue: string,
  pipeline: PipelineMeta
): Promise<void> {
  const { videoId, voiceId, avatarId, videoType } = pipeline;

  switch (currentQueue) {
    case QUEUE_NAMES.SCRAPER:
      await sendJob(QUEUE_NAMES.SCRIPT, {
        videoId,
        productData: { title: "", description: "", images: [], price: null, reviews: [] },
        videoType,
        brandKit: pipeline.brandKit,
        templateStructure: pipeline.templateStructure,
        _pipeline: pipeline,
      } satisfies ScriptJobData & { _pipeline: PipelineMeta });
      break;

    case QUEUE_NAMES.SCRIPT:
      await sendJob(QUEUE_NAMES.TTS, {
        videoId,
        scenes: [],
        voiceId,
        _pipeline: pipeline,
      } satisfies TTSJobData & { _pipeline: PipelineMeta });
      break;

    case QUEUE_NAMES.TTS:
      await sendJob(QUEUE_NAMES.AVATAR, {
        videoId,
        script: "",
        audioUrl: "",
        avatarId: avatarId ?? "",
        videoType,
        _pipeline: pipeline,
      } satisfies AvatarJobData & { _pipeline: PipelineMeta });
      break;

    case QUEUE_NAMES.AVATAR:
      await sendJob(QUEUE_NAMES.COMPOSER, {
        videoId,
        audioUrls: [],
        avatarVideoUrl: null,
        productImages: [],
        script: { type: videoType },
      } satisfies ComposerJobData);
      break;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const boss = await startBoss();

  console.log("Workers starting with pg-boss...");

  // -------------------------------------------------------------------
  // Pipeline workers — with job chaining on success
  // -------------------------------------------------------------------

  const pipelineQueues = [
    QUEUE_NAMES.SCRAPER,
    QUEUE_NAMES.SCRIPT,
    QUEUE_NAMES.TTS,
    QUEUE_NAMES.AVATAR,
  ] as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processors: Record<string, (job: { data: any }) => Promise<any>> = {
    [QUEUE_NAMES.SCRAPER]: processScraperJob,
    [QUEUE_NAMES.SCRIPT]: processScriptJob,
    [QUEUE_NAMES.TTS]: processTTSJob,
    [QUEUE_NAMES.AVATAR]: processAvatarJob,
  };

  for (const queueName of pipelineQueues) {
    const processor = processors[queueName]!;

    await boss.work(
      queueName,
      { localConcurrency: queueName === QUEUE_NAMES.SCRAPER ? 5 : 3 },
      async (jobs) => {
        const job = jobs[0];
        try {
          await processor(job);

          // Chain next pipeline step if this job is part of a pipeline
          const pipeline = (job.data as Record<string, unknown>)?._pipeline as PipelineMeta | undefined;
          if (pipeline) {
            await chainNextPipelineStep(queueName, pipeline);
          }
        } catch (error) {
          // Handle pipeline failure (refund credits)
          const data = job.data as Record<string, unknown>;
          const pipeline = data?._pipeline as PipelineMeta | undefined;
          const videoId = pipeline?.videoId ?? (data?.videoId as string | undefined);
          if (videoId) {
            await handlePipelineFailure(videoId, error instanceof Error ? error : new Error(String(error)));
          }
          throw error;
        }
      }
    );
  }

  // Composer — end of pipeline, no chaining needed
  await boss.work(
    QUEUE_NAMES.COMPOSER,
    { localConcurrency: 2 },
    async (jobs) => {
      const job = jobs[0];
      try {
        await processComposerJob(job as any);
      } catch (error) {
        const data = job.data as Record<string, unknown>;
        const videoId = data?.videoId as string | undefined;
        if (videoId) {
          await handlePipelineFailure(videoId, error instanceof Error ? error : new Error(String(error)));
        }
        throw error;
      }
    }
  );

  // -------------------------------------------------------------------
  // Non-pipeline workers
  // -------------------------------------------------------------------

  await boss.work(
    QUEUE_NAMES.CLONE_DOWNLOAD,
    { localConcurrency: 3 },
    async (jobs) => { await processVideoDownloaderJob(jobs[0] as any); }
  );

  await boss.work(
    QUEUE_NAMES.CLONE_ANALYZE,
    { localConcurrency: 2 },
    async (jobs) => { await processCloneAnalyzerJob(jobs[0] as any); }
  );

  await boss.work(
    QUEUE_NAMES.MONITOR,
    { localConcurrency: 2 },
    async (jobs) => { await processMonitorJob(jobs[0] as any); }
  );

  await boss.work(
    QUEUE_NAMES.PUBLISH,
    { localConcurrency: 2 },
    async (jobs) => { await processPublishJob(jobs[0] as any); }
  );

  await boss.work(
    QUEUE_NAMES.SCHEDULER,
    { localConcurrency: 1 },
    async (jobs) => { await processSchedulerJob(jobs[0] as any); }
  );

  // -------------------------------------------------------------------
  // Scheduler cron — check for scheduled publishes every minute
  // -------------------------------------------------------------------

  await boss.schedule(QUEUE_NAMES.SCHEDULER, "* * * * *", {
    _trigger: "cron",
  });

  console.log("Workers registered:");
  console.log("  - scraper          (concurrency: 5)");
  console.log("  - script           (concurrency: 3)");
  console.log("  - tts              (concurrency: 3)");
  console.log("  - avatar           (concurrency: 3)");
  console.log("  - composer         (concurrency: 2)");
  console.log("  - clone-download   (concurrency: 3)");
  console.log("  - clone-analyze    (concurrency: 2)");
  console.log("  - monitor          (concurrency: 2)");
  console.log("  - publish          (concurrency: 2)");
  console.log("  - scheduler        (concurrency: 1, cron: every minute)");
  console.log("Workers ready and listening for jobs via pg-boss...");

  // -------------------------------------------------------------------
  // Graceful shutdown
  // -------------------------------------------------------------------

  const shutdown = async () => {
    console.log("Shutting down workers...");
    await stopBoss();
    console.log("All workers shut down.");
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch(console.error);
