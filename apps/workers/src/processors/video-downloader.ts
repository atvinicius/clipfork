import { execFile } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { uploadToR2 } from "../lib/r2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoDownloaderJobData {
  url: string;
  orgId: string;
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
// RapidAPI TikTok fallback
// ---------------------------------------------------------------------------

async function downloadWithRapidAPI(url: string): Promise<Buffer> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (!rapidApiKey) {
    throw new Error("RAPIDAPI_KEY is not configured");
  }

  // Step 1: Get download URL from RapidAPI
  const analysisResponse = await fetch(
    "https://tiktok-download-without-watermark.p.rapidapi.com/analysis",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host":
          "tiktok-download-without-watermark.p.rapidapi.com",
        "x-rapidapi-key": rapidApiKey,
      },
      body: JSON.stringify({ url }),
    }
  );

  if (!analysisResponse.ok) {
    throw new Error(
      `RapidAPI analysis failed with status ${analysisResponse.status}`
    );
  }

  const analysisData = (await analysisResponse.json()) as {
    code: number;
    data?: { play?: string; wmplay?: string; hdplay?: string };
  };

  if (analysisData.code !== 0 || !analysisData.data) {
    throw new Error("RapidAPI analysis returned no data");
  }

  const videoUrl =
    analysisData.data.hdplay ||
    analysisData.data.play ||
    analysisData.data.wmplay;

  if (!videoUrl) {
    throw new Error("No video URL found in RapidAPI response");
  }

  // Step 2: Download the video
  const videoResponse = await fetch(videoUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!videoResponse.ok) {
    throw new Error(
      `Failed to download video from RapidAPI URL: ${videoResponse.status}`
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
      "[video-downloader] yt-dlp failed, trying RapidAPI fallback:",
      ytDlpError instanceof Error ? ytDlpError.message : ytDlpError
    );

    // Try RapidAPI fallback
    try {
      videoBuffer = await downloadWithRapidAPI(url);
      console.log(
        `[video-downloader] RapidAPI download succeeded (${videoBuffer.length} bytes)`
      );
    } catch (rapidApiError) {
      console.error(
        "[video-downloader] RapidAPI fallback also failed:",
        rapidApiError instanceof Error
          ? rapidApiError.message
          : rapidApiError
      );

      throw new Error(
        "Could not download video. Both yt-dlp and RapidAPI failed. " +
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
