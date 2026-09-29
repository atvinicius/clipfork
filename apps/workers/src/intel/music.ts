import { execFile } from "child_process";
import { promisify } from "util";
import { createHash } from "crypto";
import { intelConfig } from "./config";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Music identification.
//
// 1. Metadata path (free): TikTok/IG items carry musicMeta — handled during
//    ingest, identifiedVia="metadata".
// 2. Fingerprint path: original/unidentified audio gets a chromaprint hash
//    (fpcalc) for cross-post dedup, then an AudD lookup when AUDD_API_KEY is
//    configured — AudD identifies commercial tracks and returns ISRC +
//    streaming links, which we store on IntelSound for cross-platform joins.
// ---------------------------------------------------------------------------

export interface IdentifiedTrack {
  title: string;
  artist?: string;
  album?: string;
  isrc?: string;
  externalUrl?: string;
  releaseDate?: string;
  label?: string;
}

export interface MusicRecognizer {
  name: string;
  recognize(audio: Buffer, filename: string): Promise<IdentifiedTrack | null>;
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Chromaprint fingerprint via fpcalc; null when the binary is unavailable. */
export async function fingerprintAudio(filePath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "fpcalc",
      ["-json", filePath],
      { timeout: 30_000 }
    );
    const parsed = JSON.parse(stdout) as { fingerprint?: string };
    return parsed.fingerprint ?? null;
  } catch {
    return null;
  }
}

interface AuddResult {
  status?: string;
  result?: {
    artist?: string;
    title?: string;
    album?: string;
    release_date?: string;
    label?: string;
    isrc?: string;
    spotify?: { external_urls?: { spotify?: string } };
    apple_music?: { url?: string };
    deezer?: { link?: string };
  } | null;
}

export class AuddRecognizer implements MusicRecognizer {
  name = "audd";

  async recognize(audio: Buffer, filename: string): Promise<IdentifiedTrack | null> {
    const form = new FormData();
    form.append("api_token", intelConfig.auddApiKey);
    form.append("file", new Blob([new Uint8Array(audio)]), filename);
    form.append("return", "spotify,apple_music,deezer");

    const res = await fetch("https://api.audd.io/", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`AudD recognize failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as AuddResult;
    const r = data.result;
    if (!r?.title) return null;

    return {
      title: r.title,
      artist: r.artist,
      album: r.album,
      releaseDate: r.release_date,
      label: r.label,
      isrc: r.isrc,
      externalUrl:
        r.spotify?.external_urls?.spotify ?? r.apple_music?.url ?? r.deezer?.link,
    };
  }
}

export function getRecognizer(): MusicRecognizer | null {
  return intelConfig.auddApiKey ? new AuddRecognizer() : null;
}
