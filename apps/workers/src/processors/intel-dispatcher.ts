import { prisma } from "@ugc/db";
import { sendJob, QUEUE_NAMES } from "../queues";
import { intelConfig } from "../intel/config";

// ---------------------------------------------------------------------------
// intel-dispatch (cron): turns the IntelTarget table into work. Picks active
// targets whose nextCrawlAt is due, records a crawl run, and enqueues
// intel-collect jobs — singleton-per-target so a slow crawl can't stack up.
// ---------------------------------------------------------------------------

export async function processIntelDispatcherJob() {
  const now = new Date();

  const dueTargets = await prisma.intelTarget.findMany({
    where: { isActive: true, nextCrawlAt: { lte: now } },
    orderBy: [{ priority: "desc" }, { nextCrawlAt: "asc" }],
    take: intelConfig.maxTargetsPerTick,
  });

  if (dueTargets.length === 0) return { dispatched: 0 };

  let dispatched = 0;
  for (const target of dueTargets) {
    // Reserve the slot before enqueueing so a second dispatcher tick can't
    // double-dispatch while the job is still running.
    await prisma.intelTarget.update({
      where: { id: target.id },
      data: {
        nextCrawlAt: new Date(now.getTime() + target.crawlFrequencyMinutes * 60_000),
      },
    });

    const run = await prisma.intelCrawlRun.create({
      data: { targetId: target.id },
      select: { id: true },
    });

    await sendJob(
      QUEUE_NAMES.INTEL_COLLECT,
      { targetId: target.id, crawlRunId: run.id },
      { singletonKey: `intel-target:${target.id}` }
    );
    dispatched += 1;
  }

  console.log(`[intel-dispatch] Dispatched ${dispatched} target(s)`);
  return { dispatched };
}
