import { prisma } from "@ugc/db";
import { sendJob, QUEUE_NAMES } from "../queues";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchedulerJobData {
  _trigger: "cron";
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processSchedulerJob(job: { data: SchedulerJobData }) {
  console.log(`[scheduler] Running scheduled publish check...`);

  // Find videos that are ready to publish
  const videosToPublish = await prisma.video.findMany({
    where: {
      scheduledPublishAt: {
        lte: new Date(),
      },
      status: "COMPLETED",
      publishedAt: null,
      tiktokAccountId: {
        not: null,
      },
    },
    select: {
      id: true,
      tiktokAccountId: true,
      script: true,
    },
  });

  if (videosToPublish.length === 0) {
    console.log(`[scheduler] No videos to publish`);
    return { enqueued: 0 };
  }

  console.log(
    `[scheduler] Found ${videosToPublish.length} video(s) ready to publish`
  );

  for (const video of videosToPublish) {
    await sendJob(QUEUE_NAMES.PUBLISH, {
      videoId: video.id,
      tiktokAccountId: video.tiktokAccountId!,
    });
    console.log(`[scheduler] Enqueued publish job for video ${video.id}`);
  }

  return { enqueued: videosToPublish.length };
}
