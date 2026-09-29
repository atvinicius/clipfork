import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, readFile, rm, readdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { prisma } from "@ugc/db";
import { uploadToR2 } from "../lib/r2";
import { intelConfig } from "../intel/config";
import { getRecognizer, fingerprintAudio, sha256 } from "../intel/music";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// intel-download: fetch a post's media, enrich it.
//   yt-dlp -> R2 (video) -> ffmpeg (audio) -> R2 (audio) -> fpcalc fingerprint
//   -> AudD identify when the sound isn't already catalog-attributed.
// ---------------------------------------------------------------------------

export interface IntelDownloadJobData {
  postId: string;
}

const MAX_BYTES = 250 * 1024 * 1024;

async function runYtDlp(url: string, outDir: string, platform: string): Promise<string> {
  const args = [
    "-o", join(outDir, "video.%(ext)s"),
    "--no-playlist",
    "--no-warnings",
    "--no-check-certificates",
    "--max-filesize", String(MAX_BYTES),
    "--merge-output-format", "mp4",
    "-f", "bv*+ba/b",
  ];

  if (intelConfig.downloadProxyUrl) {
    args.push("--proxy", intelConfig.downloadProxyUrl);
  }

  const cookiesB64 =
    platform === "TIKTOK" ? intelConfig.tiktokCookiesB64 : intelConfig.igCookiesB64;
  if (cookiesB64) {
    const cookiePath = join(outDir, "cookies.txt");
    await writeFile(cookiePath, Buffer.from(cookiesB64, "base64"));
    args.push("--cookies", cookiePath);
  }

  args.push(url);
  await execFileAsync("yt-dlp", args, { timeout: 180_000 });

  const files = await readdir(outDir);
  const video = files.find((f) => f.startsWith("video."));
  if (!video) throw new Error("yt-dlp produced no video file");
  return join(outDir, video);
}

async function probeDuration(videoPath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", videoPath],
      { timeout: 15_000 }
    );
    const d = Number(stdout.trim());
    return Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
}

export async function processIntelDownloadJob(job: { data: IntelDownloadJobData }) {
  const { postId } = job.data;

  const post = await prisma.intelPost.findUnique({
    where: { id: postId },
    include: { sound: true },
  });
  if (!post) throw new Error(`IntelPost ${postId} not found`);
  if (post.mediaStatus === "READY") return { postId, skipped: "already downloaded" };

  await prisma.intelPost.update({
    where: { id: postId },
    data: { mediaStatus: "DOWNLOADING", mediaError: null },
  });

  let tempDir: string | null = null;
  try {
    tempDir = await mkdtemp(join(tmpdir(), `intel-dl-${postId}-`));
    const videoPath = await runYtDlp(post.url, tempDir, post.platform);
    const videoBuffer = await readFile(videoPath);
    const durationSec = await probeDuration(videoPath);

    const baseKey = `intel/${post.platform.toLowerCase()}/${post.platformPostId}`;
    const videoKey = `${baseKey}.mp4`;
    await uploadToR2(videoKey, videoBuffer, "video/mp4");

    // --- Audio extraction + identification -------------------------------
    let audioKey: string | null = null;
    let audioFingerprint: string | null = null;
    let mediaSha256: string | null = null;
    let identifiedVia: string | null = null;
    let identifiedSoundId = post.soundId;

    const audioPath = join(tempDir, "audio.aac");
    let audioBuffer: Buffer | null = null;
    try {
      await execFileAsync(
        "ffmpeg",
        ["-i", videoPath, "-vn", "-acodec", "aac", "-b:a", "128k", "-y", audioPath],
        { timeout: 60_000 }
      );
      audioBuffer = await readFile(audioPath);
      audioKey = `${baseKey}.aac`;
      await uploadToR2(audioKey, audioBuffer, "audio/aac");
      mediaSha256 = sha256(audioBuffer);
      audioFingerprint = await fingerprintAudio(audioPath);
    } catch (err) {
      console.warn(
        `[intel-download] audio extraction failed for ${post.url}:`,
        err instanceof Error ? err.message : err
      );
    }

    // --- Music ID: only for audio we can't already attribute -------------
    const recognizer = getRecognizer();
    const needsIdentify =
      post.sound == null || post.sound.isOriginalAudio || !post.sound.title;

    if (needsIdentify && recognizer && audioBuffer) {
      try {
        const track = await recognizer.recognize(audioBuffer, "audio.aac");
        if (track) {
          identifiedVia = "audd";
          if (post.sound && post.sound.isOriginalAudio) {
            await prisma.intelSound.update({
              where: { id: post.sound.id },
              data: {
                title: track.title,
                artist: track.artist,
                album: track.album,
                isrc: track.isrc,
                externalUrl: track.externalUrl,
                identifiedVia: "audd",
                isOriginalAudio: false,
              },
            });
          } else if (!post.sound) {
            const soundKey = `audd:${track.isrc ?? mediaSha256?.slice(0, 16)}`;
            const sound = await prisma.intelSound.upsert({
              where: {
                platform_platformSoundId: {
                  platform: post.platform,
                  platformSoundId: soundKey,
                },
              },
              create: {
                platform: post.platform,
                platformSoundId: soundKey,
                title: track.title,
                artist: track.artist,
                album: track.album,
                isrc: track.isrc,
                externalUrl: track.externalUrl,
                identifiedVia: "audd",
              },
              update: {
                title: track.title,
                artist: track.artist,
                album: track.album,
                isrc: track.isrc,
                externalUrl: track.externalUrl,
                lastSeenAt: new Date(),
              },
            });
            identifiedSoundId = sound.id;
          }
          console.log(
            `[intel-download] identified "${track.title}" by ${track.artist ?? "?"} for ${post.url}`
          );
        }
      } catch (err) {
        console.warn(
          `[intel-download] music recognition failed for ${post.url}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    await prisma.intelPost.update({
      where: { id: postId },
      data: {
        mediaStatus: "READY",
        videoKey,
        audioKey,
        audioFingerprint,
        mediaSha256,
        soundId: identifiedSoundId,
        durationSec: post.durationSec ?? durationSec,
      },
    });

    console.log(`[intel-download] ${post.url} -> ${videoKey} (identifiedVia=${identifiedVia ?? post.sound?.identifiedVia ?? "none"})`);
    return { postId, videoKey, audioKey, audioFingerprint };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.intelPost.update({
      where: { id: postId },
      data: { mediaStatus: "FAILED", mediaError: msg.slice(0, 500) },
    });
    throw err;
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
