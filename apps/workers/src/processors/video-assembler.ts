import { prisma } from "@ugc/db";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uploadToR2 } from "../lib/r2";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoAssemblerJobData {
  videoId: string;
}

interface CaptionEntry {
  text: string;
  startTime: number;
  endTime: number;
}

// ---------------------------------------------------------------------------
// FFmpeg helpers (exported for testing)
// ---------------------------------------------------------------------------

export function buildConcatFileContent(filePaths: string[]): string {
  return filePaths.map((f) => `file '${f}'`).join("\n");
}

export function buildDrawtextFilter(captions: CaptionEntry[]): string {
  if (captions.length === 0) return "";

  const filters = captions.map((c) => {
    const escapedText = c.text
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "'\\''")
      .replace(/:/g, "\\:");
    return [
      `drawtext=text='${escapedText}'`,
      "fontsize=48",
      "fontcolor=white",
      "borderw=3",
      "bordercolor=black",
      "x=(w-text_w)/2",
      "y=h-h/5",
      `enable='between(t,${c.startTime},${c.endTime})'`,
    ].join(":");
  });

  return filters.join(",");
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processVideoAssemblerJob(job: { data: VideoAssemblerJobData }) {
  const { videoId } = job.data;
  let tempDir: string | null = null;

  console.log(`[video-assembler] Starting assembly for video ${videoId}`);

  try {
    const video = await prisma.video.findUniqueOrThrow({
      where: { id: videoId },
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { status: "COMPOSING" },
    });

    const sceneVideos = (video.sceneVideos ?? []) as string[][];
    const scriptVariant = (video.scriptVariant ?? {}) as Record<string, unknown>;

    if (sceneVideos.length === 0) {
      throw new Error("No scene videos found");
    }

    tempDir = await mkdtemp(join(tmpdir(), `video-${videoId}-`));

    const sceneFilePaths: string[] = [];
    for (let i = 0; i < sceneVideos.length; i++) {
      const segments = sceneVideos[i]!;
      for (let j = 0; j < segments.length; j++) {
        const url = segments[j]!;
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const filePath = join(tempDir, `scene-${i}-part-${j}.mp4`);
        await writeFile(filePath, buffer);
        sceneFilePaths.push(filePath);
      }
    }

    const audioFilePaths: string[] = [];
    const audioUrl = video.audioUrl;
    if (audioUrl) {
      const response = await fetch(audioUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      const audioPath = join(tempDir, "audio.mp3");
      await writeFile(audioPath, buffer);
      audioFilePaths.push(audioPath);
    }

    const concatContent = buildConcatFileContent(sceneFilePaths);
    const concatFilePath = join(tempDir, "scenes.txt");
    await writeFile(concatFilePath, concatContent);

    const captions = buildCaptionsFromScript(scriptVariant);

    const outputPath = join(tempDir, "output.mp4");
    const ffmpegArgs = buildFFmpegArgs(concatFilePath, audioFilePaths[0], captions, outputPath);

    console.log(`[video-assembler] Running FFmpeg with ${sceneFilePaths.length} clips`);

    await execFileAsync("ffmpeg", ffmpegArgs, { timeout: 300_000 });

    const outputBuffer = await readFile(outputPath);
    const r2Key = `videos/${videoId}/final.mp4`;
    const finalUrl = await uploadToR2(r2Key, outputBuffer, "video/mp4");

    const totalDuration = sceneVideos.flat().length * 6;

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "COMPLETED",
        finalVideoUrl: finalUrl,
        duration: totalDuration,
      },
    });

    console.log(`[video-assembler] Video ${videoId} assembled and uploaded`);

    return { videoId, finalVideoUrl: finalUrl, duration: totalDuration };
  } catch (error) {
    console.error(`[video-assembler] Failed to assemble video ${videoId}:`, error);

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "FAILED",
        error: `Assembly failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    });

    throw error;
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildFFmpegArgs(
  concatFile: string,
  audioFile: string | undefined,
  captions: CaptionEntry[],
  outputPath: string
): string[] {
  const args: string[] = [
    "-f", "concat",
    "-safe", "0",
    "-i", concatFile,
  ];

  if (audioFile) {
    args.push("-i", audioFile);
  }

  const drawtextFilter = buildDrawtextFilter(captions);
  if (drawtextFilter) {
    args.push("-vf", drawtextFilter);
  }

  args.push(
    "-c:v", "libx264",
    "-preset", "fast",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-y",
    outputPath
  );

  return args;
}

function buildCaptionsFromScript(
  scriptVariant: Record<string, unknown>
): CaptionEntry[] {
  const captions: CaptionEntry[] = [];
  let currentTime = 0;

  const scenes = (scriptVariant.scenes ?? []) as Array<{
    text?: string;
    voiceover?: string;
    text_overlay?: string;
    duration_s: number;
  }>;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!scene) continue;

    const text = scene.voiceover ?? scene.text ?? scene.text_overlay;
    const duration = scene.duration_s ?? 5;

    if (text && text.trim().length > 0) {
      captions.push({
        text: text.trim(),
        startTime: currentTime,
        endTime: currentTime + duration,
      });
    }

    currentTime += duration;
  }

  return captions;
}
