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
 * Avatar generation is currently disabled.
 * The pipeline step is kept as a pass-through so the job flow isn't broken.
 * When a better avatar provider is integrated, replace this stub.
 */
export async function processAvatarJob(job: { data: AvatarJobData }) {
  const { videoId, videoType } = job.data;

  console.log(`[avatar] Skipping avatar generation for video ${videoId} (provider not configured)`);

  return {
    videoId,
    avatarVideoUrl: null,
    skipped: true,
  };
}
