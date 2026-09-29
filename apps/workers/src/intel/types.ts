import type { Platform } from "@ugc/db";

// ---------------------------------------------------------------------------
// Normalized collection shapes — what every collector provider must produce.
// Platform-specific item payloads (Apify dataset rows, yt-dlp info JSON) are
// parsed into these before anything touches the database.
// ---------------------------------------------------------------------------

export interface CollectedCreator {
  platformUserId?: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  verified: boolean;
  followers?: number;
  following?: number;
  likesTotal?: number;
  videoCount?: number;
}

export interface CollectedSound {
  platformSoundId: string;
  title?: string;
  artist?: string;
  durationSec?: number;
  isOriginalAudio: boolean;
  usageCount?: number;
  coverUrl?: string;
}

export interface CollectedMetrics {
  views: bigint;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface CollectedPost {
  platformPostId: string;
  url: string;
  caption?: string;
  hashtags: string[];
  mentions: string[];
  postedAt?: Date;
  durationSec?: number;
  coverUrl?: string;
  metrics: CollectedMetrics;
  creator?: CollectedCreator;
  sound?: CollectedSound;
  /** Original provider item, stored on the post for later re-parsing. */
  raw: Record<string, unknown>;
}

export interface CollectRequest {
  platform: Platform;
  targetType: "ACCOUNT" | "HASHTAG" | "SOUND" | "KEYWORD";
  /** Handle / hashtag / sound id-or-url / keyword. */
  value: string;
  /** How many items to request per run. */
  limit: number;
}

export interface CollectorProvider {
  name: string;
  collect(req: CollectRequest): Promise<CollectedPost[]>;
}
