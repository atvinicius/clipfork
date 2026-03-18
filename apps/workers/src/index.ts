import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { startBoss, stopBoss } from "./boss";
import { QUEUE_NAMES, sendJob } from "./queues";
import { processScraperJob } from "./processors/scraper";
import { processScriptJob } from "./processors/script-generator";
import { processTTSJob } from "./processors/tts";
import { processSceneGeneratorJob } from "./processors/scene-generator";
import { processVideoAssemblerJob } from "./processors/video-assembler";
import { processLoRATrainingJob } from "./processors/lora-trainer";
import { handlePipelineFailure } from "./processors/pipeline";
import { processVideoDownloaderJob } from "./processors/video-downloader";
import { processCloneAnalyzerJob } from "./processors/clone-analyzer";
import { processMonitorJob } from "./processors/monitor";
import { processPublishJob } from "./processors/publisher";
import { processSchedulerJob } from "./processors/scheduler";
import type { ScriptJobData } from "./processors/script-generator";
import type { TTSJobData } from "./processors/tts";

// ---------------------------------------------------------------------------
// Pipeline metadata — carries IDs + data needed by existing processors
// ---------------------------------------------------------------------------

interface PipelineMeta {
  videoId: string;
  productUrl: string;
  productId: string;
  orgId: string;
  videoType: "TALKING_HEAD" | "FACELESS" | "CLONED";
  voiceId: string;
  brandKitId?: string;
  presetId?: string;
  templateId?: string;
  // Legacy fields — still needed by scraper/script/TTS processors
  brandKit: ScriptJobData["brandKit"];
  templateStructure: ScriptJobData["templateStructure"];
}

// ---------------------------------------------------------------------------
// Pipeline step chaining — hybrid approach:
// - SCRAPER→SCRIPT→TTS: old data-forwarding pattern (existing processors unchanged)
// - TTS→SCENE_GENERATOR→VIDEO_ASSEMBLER: simplified DB-mediated flow (new processors)
// ---------------------------------------------------------------------------

async function chainNextPipelineStep(
  currentQueue: string,
  pipeline: PipelineMeta
): Promise<void> {
  const { videoId, voiceId, videoType } = pipeline;

  switch (currentQueue) {
    // --- Old data-forwarding pattern (existing processors expect job.data fields) ---
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
      // For CLONED videos, skip TTS — use the original viral audio instead
      if (videoType === "CLONED") {
        // Set the source audio URL on the Video record
        const templateStruct = pipeline.templateStructure as Record<string, unknown> | null;
        const sourceAudioUrl = (templateStruct as any)?.sourceAudioUrl as string | null;
        if (sourceAudioUrl) {
          const { prisma: db } = await import("@ugc/db");
          await db.video.update({
            where: { id: videoId },
            data: { audioUrl: sourceAudioUrl },
          });
          console.log(`[pipeline] CLONED: skipping TTS, using source audio`);
        } else {
          console.warn(`[pipeline] CLONED: no source audio found, skipping TTS`);
        }

        await sendJob(QUEUE_NAMES.SCENE_GENERATOR, {
          videoId,
          _pipeline: pipeline,
        });
        break;
      }

      await sendJob(QUEUE_NAMES.TTS, {
        videoId,
        scenes: [],
        voiceId,
        _pipeline: pipeline,
      } satisfies TTSJobData & { _pipeline: PipelineMeta });
      break;

    // --- New DB-mediated pattern (new processors read from DB using videoId) ---
    case QUEUE_NAMES.TTS:
      await sendJob(QUEUE_NAMES.SCENE_GENERATOR, {
        videoId,
        _pipeline: pipeline,
      });
      break;

    case QUEUE_NAMES.SCENE_GENERATOR:
      await sendJob(QUEUE_NAMES.VIDEO_ASSEMBLER, {
        videoId,
        _pipeline: pipeline,
      });
      break;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const boss = await startBoss();

  console.log("Workers starting with pg-boss...");

  // Pre-create all queues so work() doesn't fail on missing queues
  const allQueues = Object.values(QUEUE_NAMES);
  for (const q of allQueues) {
    await boss.createQueue(q);
  }
  console.log(`Created ${allQueues.length} queues`);

  // -------------------------------------------------------------------
  // Pipeline workers — with job chaining on success
  // -------------------------------------------------------------------

  const pipelineQueues = [
    QUEUE_NAMES.SCRAPER,
    QUEUE_NAMES.SCRIPT,
    QUEUE_NAMES.TTS,
    QUEUE_NAMES.SCENE_GENERATOR,
  ] as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processors: Record<string, (job: { data: any }) => Promise<any>> = {
    [QUEUE_NAMES.SCRAPER]: processScraperJob,
    [QUEUE_NAMES.SCRIPT]: processScriptJob,
    [QUEUE_NAMES.TTS]: processTTSJob,
    [QUEUE_NAMES.SCENE_GENERATOR]: processSceneGeneratorJob,
  };

  const concurrencyMap: Record<string, number> = {
    [QUEUE_NAMES.SCRAPER]: 5,
    [QUEUE_NAMES.SCRIPT]: 3,
    [QUEUE_NAMES.TTS]: 3,
    [QUEUE_NAMES.SCENE_GENERATOR]: 2,
  };

  for (const queueName of pipelineQueues) {
    const processor = processors[queueName]!;

    await boss.work(
      queueName,
      { localConcurrency: concurrencyMap[queueName] ?? 3 },
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

  // Video Assembler — end of pipeline, no chaining needed
  await boss.work(
    QUEUE_NAMES.VIDEO_ASSEMBLER,
    { localConcurrency: 2 },
    async (jobs) => {
      const job = jobs[0];
      try {
        await processVideoAssemblerJob(job as any);
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

  // LoRA Training — independent, not part of video pipeline
  await boss.work(
    QUEUE_NAMES.LORA_TRAINING,
    { localConcurrency: 1 },
    async (jobs) => { await processLoRATrainingJob(jobs[0] as any); }
  );

  // -------------------------------------------------------------------
  // Non-pipeline workers
  // -------------------------------------------------------------------

  // Clone download — chains to clone-analyze after download completes
  // (inline chaining, not using chainNextPipelineStep, because this is a
  // simple two-step flow with no Video record or credit refund logic)
  await boss.work(
    QUEUE_NAMES.CLONE_DOWNLOAD,
    { localConcurrency: 3 },
    async (jobs) => {
      const job = jobs[0];
      const result = await processVideoDownloaderJob(job as any);

      const data = job.data as { url: string; orgId: string; sourceUrl?: string };
      await sendJob(QUEUE_NAMES.CLONE_ANALYZE, {
        videoUrl: result.videoUrl,
        videoKey: result.videoKey,
        audioUrl: result.audioUrl ?? null,
        sourceUrl: data.sourceUrl ?? data.url,
        orgId: data.orgId,
      });

      console.log(`[clone-download] Chained to clone-analyze for ${data.url}`);
    }
  );

  await boss.work(
    QUEUE_NAMES.CLONE_ANALYZE,
    { localConcurrency: 2 },
    async (jobs) => {
      try {
        await processCloneAnalyzerJob(jobs[0] as any);
      } catch (err) {
        console.error("[clone-analyze] FAILED:", err instanceof Error ? err.message : err);
        console.error("[clone-analyze] Stack:", err instanceof Error ? err.stack : "");
        throw err;
      }
    }
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
  // Scheduler cron — check for scheduled publishes every 5 minutes
  // -------------------------------------------------------------------

  await boss.schedule(QUEUE_NAMES.SCHEDULER, "*/5 * * * *", {
    _trigger: "cron",
  });

  console.log("Workers registered:");
  console.log("  - scraper            (concurrency: 5)");
  console.log("  - script             (concurrency: 3)");
  console.log("  - tts                (concurrency: 3)");
  console.log("  - scene-generator    (concurrency: 2)");
  console.log("  - video-assembler    (concurrency: 2)");
  console.log("  - lora-training      (concurrency: 1)");
  console.log("  - clone-download     (concurrency: 3)");
  console.log("  - clone-analyze      (concurrency: 2)");
  console.log("  - monitor            (concurrency: 2)");
  console.log("  - publish            (concurrency: 2)");
  console.log("  - scheduler          (concurrency: 1, cron: every 5 min)");
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
