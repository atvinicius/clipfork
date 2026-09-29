import { ApifyClient } from "apify-client";
import { intelConfig } from "./config";
import { parseTikTokItem, parseInstagramItem } from "./parse";
import type { CollectRequest, CollectedPost, CollectorProvider } from "./types";

// ---------------------------------------------------------------------------
// Apify-backed collector. Actors run on Apify's infrastructure, so IP
// reputation and cookies are their problem — we pay per result, not per IP.
// Provider seam: swap or layer collectors (e.g. a residential-proxy yt-dlp
// collector) by implementing CollectorProvider.
// ---------------------------------------------------------------------------

const ACTORS = {
  TIKTOK_FEED: "clockworks/free-tiktok-scraper",
  TIKTOK_SOUND: "clockworks/tiktok-sound-scraper",
  IG_POSTS: "apify/instagram-post-scraper",
  IG_HASHTAG: "apify/instagram-hashtag-scraper",
} as const;

type DatasetItem = Record<string, unknown>;

function getClient(): ApifyClient {
  if (!intelConfig.apifyToken) {
    throw new Error("APIFY_API_TOKEN is not set — intel collection cannot run");
  }
  return new ApifyClient({ token: intelConfig.apifyToken });
}

async function runActor(
  actorId: string,
  input: Record<string, unknown>
): Promise<DatasetItem[]> {
  const client = getClient();
  const run = await client.actor(actorId).call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items as DatasetItem[];
}

function tiktokSoundUrl(value: string): string {
  if (value.startsWith("http")) return value;
  if (/^\d{10,}$/.test(value)) {
    return `https://www.tiktok.com/music/sound-${value}`;
  }
  return `https://www.tiktok.com/music/${value}`;
}

export class ApifyCollector implements CollectorProvider {
  name = "apify";

  async collect(req: CollectRequest): Promise<CollectedPost[]> {
    const limit = req.limit || intelConfig.resultsPerPage;

    if (req.platform === "TIKTOK") {
      switch (req.targetType) {
        case "ACCOUNT":
          return this.tiktok({ profiles: [stripAt(req.value)] }, limit);
        case "HASHTAG":
          return this.tiktok({ hashtags: [stripHash(req.value)] }, limit);
        case "KEYWORD":
          return this.tiktok({ searchQueries: [req.value] }, limit);
        case "SOUND":
          return this.tiktokSound(req.value, limit);
      }
    }

    if (req.platform === "INSTAGRAM") {
      switch (req.targetType) {
        case "ACCOUNT":
          return this.instagram(ACTORS.IG_POSTS, {
            username: [stripAt(req.value)],
            resultsLimit: limit,
          });
        case "HASHTAG":
          return this.instagram(ACTORS.IG_HASHTAG, {
            hashtags: [stripHash(req.value)],
            resultsLimit: limit,
          });
        case "KEYWORD":
          return this.instagram("apify/instagram-search-scraper", {
            search: req.value,
            searchType: "hashtag",
            resultsLimit: limit,
          });
        case "SOUND":
          throw new Error(
            "Instagram SOUND targets are not supported by the Apify provider yet"
          );
      }
    }

    throw new Error(`Unsupported platform ${req.platform}`);
  }

  private async tiktok(
    scope: Record<string, unknown>,
    limit: number
  ): Promise<CollectedPost[]> {
    const items = await runActor(ACTORS.TIKTOK_FEED, {
      ...scope,
      resultsPerPage: limit,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadSubtitles: false,
    });
    return items
      .map((i) => parseTikTokItem(i))
      .filter((p): p is CollectedPost => p !== null);
  }

  private async tiktokSound(
    value: string,
    limit: number
  ): Promise<CollectedPost[]> {
    const items = await runActor(ACTORS.TIKTOK_SOUND, {
      musics: [tiktokSoundUrl(value)],
      resultsPerPage: limit,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
    });
    return items
      .map((i) => parseTikTokItem(i))
      .filter((p): p is CollectedPost => p !== null);
  }

  private async instagram(
    actorId: string,
    input: Record<string, unknown>
  ): Promise<CollectedPost[]> {
    const items = await runActor(actorId, input);
    return items
      .map((i) => parseInstagramItem(i))
      .filter((p): p is CollectedPost => p !== null);
  }
}

function stripAt(v: string): string {
  return v.replace(/^@/, "").trim();
}

function stripHash(v: string): string {
  return v.replace(/^#/, "").trim();
}

export function getCollector(): CollectorProvider {
  return new ApifyCollector();
}
