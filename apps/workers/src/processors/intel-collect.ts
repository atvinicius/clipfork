import { prisma } from "@ugc/db";
import { sendJob, QUEUE_NAMES } from "../queues";
import { getCollector } from "../intel/apify";
import { ingestCollectedPosts } from "../intel/ingest";
import { intelConfig } from "../intel/config";

// ---------------------------------------------------------------------------
// intel-collect: one job = one crawl run for one target. Collects normalized
// posts via the provider, ingests them, then fans out media downloads per the
// target's download policy.
// ---------------------------------------------------------------------------

export interface IntelCollectJobData {
  targetId: string;
  crawlRunId: string;
}

function selectDownloads(
  candidates: Array<{ postId: string; views: bigint; isNew: boolean }>,
  policy: string,
  topK: number
): Array<{ postId: string }> {
  const cap = intelConfig.maxDownloadsPerCrawl;
  switch (policy) {
    case "NONE":
      return [];
    case "ALL":
      return candidates.slice(0, cap).map((c) => ({ postId: c.postId }));
    case "TOP_K":
      return candidates.slice(0, Math.min(topK, cap)).map((c) => ({ postId: c.postId }));
    case "VIRAL_ONLY":
    default:
      // Cheap first-pass virality heuristic; the signal engine re-scores with
      // full history later. Fresh posts from an account with no baseline get
      // flagged on absolute view count.
      return candidates
        .filter(
          (c) =>
            c.isNew && (Number(c.views) >= 1_000_000 || Number(c.views) >= 200_000)
        )
        .slice(0, cap)
        .map((c) => ({ postId: c.postId }));
  }
}

export async function processIntelCollectJob(job: { data: IntelCollectJobData }) {
  const { targetId, crawlRunId } = job.data;

  const target = await prisma.intelTarget.findUnique({ where: { id: targetId } });
  if (!target || !target.isActive) {
    await prisma.intelCrawlRun.update({
      where: { id: crawlRunId },
      data: { status: "COMPLETED", finishedAt: new Date(), error: "Target missing or inactive" },
    }).catch(() => {});
    return;
  }

  try {
    const collector = getCollector();
    const posts = await collector.collect({
      platform: target.platform,
      targetType: target.type,
      value: target.value,
      limit: intelConfig.resultsPerPage,
    });

    const ingest = await ingestCollectedPosts(target.platform, target.id, posts);

    // Fan out downloads per policy
    const downloads = selectDownloads(
      ingest.candidates,
      target.downloadPolicy,
      target.downloadTopK
    );
    for (const d of downloads) {
      await prisma.intelPost.update({
        where: { id: d.postId },
        data: { mediaStatus: "PENDING" },
      });
      await sendJob(
        QUEUE_NAMES.INTEL_DOWNLOAD,
        { postId: d.postId },
        { singletonKey: `intel-dl:${d.postId}`, retryLimit: 2 }
      );
    }

    await prisma.$transaction([
      prisma.intelCrawlRun.update({
        where: { id: crawlRunId },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          itemsFound: ingest.itemsFound,
          newPosts: ingest.newPosts,
          newSounds: ingest.newSounds,
          newCreators: ingest.newCreators,
          downloadsEnqueued: downloads.length,
        },
      }),
      prisma.intelTarget.update({
        where: { id: targetId },
        data: { lastCrawledAt: new Date(), consecutiveFailures: 0 },
      }),
    ]);

    console.log(
      `[intel-collect] ${target.platform}/${target.type}:${target.value} — ` +
        `${ingest.itemsFound} items, ${ingest.newPosts} new posts, ${downloads.length} downloads`
    );
    return { itemsFound: ingest.itemsFound, newPosts: ingest.newPosts };
  } catch (err) {
    const failures = target.consecutiveFailures + 1;
    // Exponential backoff on the target's next slot (cap ~32x frequency)
    const backoffMin = target.crawlFrequencyMinutes * Math.min(2 ** failures, 32);
    await prisma.$transaction([
      prisma.intelCrawlRun.update({
        where: { id: crawlRunId },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          error: err instanceof Error ? err.message : String(err),
        },
      }),
      prisma.intelTarget.update({
        where: { id: targetId },
        data: {
          consecutiveFailures: failures,
          nextCrawlAt: new Date(Date.now() + backoffMin * 60_000),
        },
      }),
    ]);
    throw err;
  }
}
