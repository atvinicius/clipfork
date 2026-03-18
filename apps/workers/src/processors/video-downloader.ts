import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { readFile } from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { uploadToR2 } from "../lib/r2";

const execFileAsync = promisify(execFile);

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
  audioUrl?: string;
  audioKey?: string;
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

  // Upload video to R2
  const id = uuidv4();
  const videoKey = `clones/${orgId}/${id}.mp4`;

  console.log(`[video-downloader] Uploading video to R2: ${videoKey}`);
  const videoUrl = await uploadToR2(videoKey, videoBuffer, "video/mp4");
  console.log(`[video-downloader] Video upload complete: ${videoUrl}`);

  // Extract audio from the downloaded video using FFmpeg
  let audioUrl: string | undefined;
  let audioKey: string | undefined;
  let tempDir: string | null = null;

  try {
    tempDir = await mkdtemp(join(tmpdir(), `audio-extract-${id}-`));
    const videoPath = join(tempDir, "source.mp4");
    const audioPath = join(tempDir, "audio.aac");

    await writeFile(videoPath, videoBuffer);
    await execFileAsync("ffmpeg", [
      "-i", videoPath,
      "-vn",              // no video
      "-acodec", "aac",
      "-b:a", "128k",
      "-y",
      audioPath,
    ], { timeout: 30_000 });

    const audioBuffer = await readFile(audioPath);
    audioKey = `clones/${orgId}/${id}-audio.aac`;
    audioUrl = await uploadToR2(audioKey, audioBuffer, "audio/aac");

    console.log(`[video-downloader] Audio extracted and uploaded: ${audioKey} (${audioBuffer.length} bytes)`);
  } catch (audioErr) {
    console.warn(
      "[video-downloader] Audio extraction failed (non-fatal):",
      audioErr instanceof Error ? audioErr.message : audioErr
    );
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  return { videoUrl, videoKey, audioUrl, audioKey };
}
