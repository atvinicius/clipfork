import { Job } from "bullmq";
import { prisma } from "@ugc/db";
import { uploadToR2 } from "../lib/r2";

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

interface DIDTalkResponse {
  id: string;
  status: "created" | "started" | "done" | "error" | "rejected";
  result_url?: string;
  error?: {
    kind: string;
    description: string;
  };
}

// ---------------------------------------------------------------------------
// D-ID API helpers
// ---------------------------------------------------------------------------

const DID_API_BASE = "https://api.d-id.com";

function getDIDHeaders(): Record<string, string> {
  return {
    Authorization: `Basic ${process.env.DID_API_KEY!}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function createDIDTalk(
  audioUrl: string,
  avatarId: string
): Promise<string> {
  const response = await fetch(`${DID_API_BASE}/talks`, {
    method: "POST",
    headers: getDIDHeaders(),
    body: JSON.stringify({
      source_url: avatarId,
      script: {
        type: "audio",
        audio_url: audioUrl,
      },
      config: {
        fluent: true,
        stitch: true,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`D-ID create talk failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as DIDTalkResponse;
  return data.id;
}

async function pollDIDTalk(
  talkId: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${DID_API_BASE}/talks/${talkId}`, {
      method: "GET",
      headers: getDIDHeaders(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`D-ID poll failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as DIDTalkResponse;

    switch (data.status) {
      case "done":
        if (!data.result_url) {
          throw new Error("D-ID talk completed but no result_url returned");
        }
        return data.result_url;

      case "error":
      case "rejected":
        throw new Error(
          `D-ID talk failed: ${data.error?.description ?? data.status}`
        );

      case "created":
      case "started":
        // Still processing, wait and retry
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        break;

      default:
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        break;
    }
  }

  throw new Error(
    `D-ID talk timed out after ${maxAttempts * intervalMs}ms (talkId: ${talkId})`
  );
}

async function downloadVideo(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processAvatarJob(job: Job<AvatarJobData>) {
  const { videoId, audioUrl, avatarId, videoType } = job.data;

  // Skip if video is FACELESS — no avatar needed
  if (videoType === "FACELESS") {
    console.log(`[avatar] Skipping avatar for FACELESS video ${videoId}`);
    return {
      videoId,
      avatarVideoUrl: null,
      skipped: true,
    };
  }

  console.log(
    `[avatar] Generating avatar video for ${videoId} (avatar: ${avatarId})`
  );

  try {
    // Update video status
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "GENERATING_AVATAR" },
    });

    // Step 1: Create D-ID talk
    console.log(`[avatar] Creating D-ID talk for video ${videoId}`);
    const talkId = await createDIDTalk(audioUrl, avatarId);
    console.log(`[avatar] D-ID talk created: ${talkId}`);

    await job.updateProgress(25);

    // Step 2: Poll until complete
    console.log(`[avatar] Polling D-ID talk ${talkId}...`);
    const resultUrl = await pollDIDTalk(talkId);
    console.log(`[avatar] D-ID talk completed: ${resultUrl}`);

    await job.updateProgress(75);

    // Step 3: Download result video
    console.log(`[avatar] Downloading avatar video...`);
    const videoBuffer = await downloadVideo(resultUrl);

    // Step 4: Upload to R2
    const key = `videos/${videoId}/avatar.mp4`;
    const avatarVideoUrl = await uploadToR2(key, videoBuffer, "video/mp4");
    console.log(`[avatar] Avatar video uploaded: ${key}`);

    await job.updateProgress(100);

    // Step 5: Update Video record
    await prisma.video.update({
      where: { id: videoId },
      data: { avatarVideoUrl },
    });

    console.log(`[avatar] Avatar generation complete for video ${videoId}`);

    return {
      videoId,
      avatarVideoUrl,
      skipped: false,
    };
  } catch (error) {
    console.error(
      `[avatar] Failed to generate avatar for ${videoId}:`,
      error
    );

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "FAILED",
        error: `Avatar generation failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    });

    throw error;
  }
}
