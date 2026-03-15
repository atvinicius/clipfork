import { prisma } from "@ugc/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvatarJobData {
  videoId: string;
  script: string;
  audioUrl: string;
  avatarId: string;
  videoType: "TALKING_HEAD" | "FACELESS" | "CLONED";
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

/**
 * Avatar generation is currently a pass-through stub.
 * The pipeline step is kept so the job flow isn't broken.
 * This will be repurposed for AI-generated characters in a future iteration.
 */
export async function processAvatarJob(job: { data: AvatarJobData }) {
  const { videoId, videoType } = job.data;

  console.log(`[avatar] Skipping avatar generation for video ${videoId} (not yet implemented)`);

  return {
    videoId,
    avatarVideoUrl: null,
    skipped: true,
  };
}
