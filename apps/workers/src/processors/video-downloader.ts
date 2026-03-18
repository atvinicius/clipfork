import { execFile } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { uploadToR2 } from "../lib/r2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoDownloaderJobData {
  url: string;
  orgId: string;
  sourceUrl?: string;
  templateId?: string;
}

export interface VideoDownloaderResult {
  videoUrl: string;
  videoKey: string;
}

// ---------------------------------------------------------------------------
// yt-dlp download
// ---------------------------------------------------------------------------

async function downloadWithYtDlp(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const child = execFile(
      "yt-dlp",
      ["-o", "-", "--no-warnings", "--no-check-certificates", url],
      { maxBuffer: 200 * 1024 * 1024, encoding: "buffer" },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout as unknown as Buffer);
      }
    );

    child.stdout?.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("yt-dlp is not installed or not found in PATH"));
      } else {
        reject(err);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// TikTok download API fallback (no auth required)
// ---------------------------------------------------------------------------

async function downloadWithTikTokAPI(url: string): Promise<Buffer> {
  const apiUrl = `https://tdownv4.sl-bjs.workers.dev/?down=${encodeURIComponent(url)}`;

  const response = await fetch(apiUrl, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`TikTok download API failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    download_url?: string;
    title?: string;
  };

  if (!data.download_url) {
    throw new Error("TikTok download API returned no download URL");
  }

  const videoResponse = await fetch(data.download_url, {
    signal: AbortSignal.timeout(60_000),
  });

  if (!videoResponse.ok) {
    throw new Error(
      `Failed to download video: ${videoResponse.status}`
    );
  }

  return Buffer.from(await videoResponse.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processVideoDownloaderJob(
  job: { data: VideoDownloaderJobData }
): Promise<VideoDownloaderResult> {
  const { url, orgId } = job.data;

  console.log(`[video-downloader] Starting download for URL: ${url}`);

  let videoBuffer: Buffer | null = null;

  // Try yt-dlp first
  try {
    console.log("[video-downloader] Attempting yt-dlp download...");
    videoBuffer = await downloadWithYtDlp(url);
    console.log(
      `[video-downloader] yt-dlp download succeeded (${videoBuffer.length} bytes)`
    );
  } catch (ytDlpError) {
    console.warn(
      "[video-downloader] yt-dlp failed, trying TikTok API fallback:",
      ytDlpError instanceof Error ? ytDlpError.message : ytDlpError
    );

    // Try TikTok download API fallback
    try {
      videoBuffer = await downloadWithTikTokAPI(url);
      console.log(
        `[video-downloader] TikTok API download succeeded (${videoBuffer.length} bytes)`
      );
    } catch (rapidApiError) {
      console.error(
        "[video-downloader] TikTok API fallback also failed:",
        rapidApiError instanceof Error
          ? rapidApiError.message
          : rapidApiError
      );

      throw new Error(
        "Could not download video. Both yt-dlp and TikTok API failed. " +
          "Please try uploading the video directly instead."
      );
    }
  }

  if (!videoBuffer || videoBuffer.length === 0) {
    throw new Error("Downloaded video is empty");
  }

  // Upload to R2
  const videoId = uuidv4();
  const videoKey = `clones/${orgId}/${videoId}.mp4`;

  console.log(`[video-downloader] Uploading to R2: ${videoKey}`);

  const videoUrl = await uploadToR2(videoKey, videoBuffer, "video/mp4");

  console.log(`[video-downloader] Upload complete: ${videoUrl}`);

  return { videoUrl, videoKey };
}
