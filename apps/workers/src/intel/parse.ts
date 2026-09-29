import type { CollectedPost, CollectedCreator, CollectedSound } from "./types";

// ---------------------------------------------------------------------------
// Pure parsers: raw provider items -> CollectedPost. No I/O — unit tested
// against fixtures. Handles the field-name drift between Apify actors
// (clockworks/free-tiktok-scraper, apify/instagram-*-scraper) by probing
// every known alias.
// ---------------------------------------------------------------------------

type Item = Record<string, unknown>;

function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v);
  return s === "" ? undefined : s;
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

function asObj(v: unknown): Item | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Item)
    : undefined;
}

function first(...vals: Array<unknown>): unknown {
  return vals.find((v) => v !== undefined && v !== null);
}

function parseDate(v: unknown): Date | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") {
    // createTime is epoch seconds on TikTok items
    const ms = v > 1e12 ? v : v * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;
const MENTION_RE = /@([\w.]+)/g;

export function extractHashtags(item: Item, caption: string | undefined): string[] {
  const fromList = Array.isArray(item.hashtags)
    ? item.hashtags
        .map((h) => (typeof h === "string" ? h : str(asObj(h)?.name)))
        .filter((h): h is string => Boolean(h))
    : [];
  const fromText = caption ? [...caption.matchAll(HASHTAG_RE)].map((m) => m[1]!) : [];
  return [...new Set([...fromList, ...fromText].map((h) => h.toLowerCase()))];
}

export function extractMentions(item: Item, caption: string | undefined): string[] {
  const fromList = Array.isArray(item.mentions)
    ? item.mentions
        .map((m) => (typeof m === "string" ? m : str(asObj(m)?.name ?? asObj(m)?.username)))
        .filter((m): m is string => Boolean(m))
    : [];
  const fromText = caption ? [...caption.matchAll(MENTION_RE)].map((m) => m[1]!) : [];
  return [...new Set([...fromList, ...fromText])];
}

// ---------------------------------------------------------------------------
// TikTok (clockworks/free-tiktok-scraper shape)
// ---------------------------------------------------------------------------

export function parseTikTokItem(item: Item): CollectedPost | null {
  const id = str(first(item.id, item.videoId, item.awemeId));
  if (!id) return null;

  const author = asObj(item.authorMeta) ?? asObj(item.author);
  const username = str(
    first(author?.name, author?.uniqueId, author?.username, author?.id)
  );

  const creator: CollectedCreator | undefined = username
    ? {
        username,
        platformUserId: str(first(author?.id, author?.uid)),
        displayName: str(first(author?.nickName, author?.nickname, author?.displayName)),
        avatarUrl: str(first(author?.avatar, author?.avatarThumb, author?.profilePicUrl)),
        verified: bool(first(author?.verified, author?.isVerified)),
        followers: num(first(author?.fans, author?.followers, author?.followerCount)),
        following: num(first(author?.following, author?.followingCount)),
        likesTotal: num(first(author?.heart, author?.likes, author?.digg)),
        videoCount: num(first(author?.video, author?.videoCount)),
      }
    : undefined;

  const music = asObj(item.musicMeta) ?? asObj(item.music);
  const soundId = str(first(music?.musicId, music?.id, music?.soundId));
  const sound: CollectedSound | undefined = soundId
    ? {
        platformSoundId: soundId,
        title: str(first(music?.musicName, music?.title, music?.name)),
        artist: str(first(music?.musicAuthor, music?.authorName, music?.author)),
        durationSec: num(first(music?.duration, music?.durationSec)) || undefined,
        isOriginalAudio: bool(first(music?.musicOriginal, music?.original)),
        coverUrl: str(first(music?.coverLarge, music?.coverMedium, music?.coverUrl)),
      }
    : undefined;

  const caption = str(first(item.text, item.desc, item.caption));
  const covers = asObj(item.covers) ?? asObj(item.videoMeta);

  return {
    platformPostId: id,
    url:
      str(first(item.webVideoUrl, item.url)) ??
      (username
        ? `https://www.tiktok.com/@${username}/video/${id}`
        : `https://www.tiktok.com/video/${id}`),
    caption,
    hashtags: extractHashtags(item, caption),
    mentions: extractMentions(item, caption),
    postedAt: parseDate(first(item.createTimeISO, item.createTime, item.postedAt, item.timestamp)),
    durationSec: num(first(item.duration, asObj(item.videoMeta)?.duration)) || undefined,
    coverUrl: str(first(covers?.default, covers?.origin, item.coverUrl, item.displayUrl)),
    metrics: {
      views: BigInt(Math.round(num(first(item.playCount, item.views, item.viewCount)))),
      likes: num(first(item.diggCount, item.likes, item.likeCount)),
      comments: num(first(item.commentCount, item.comments)),
      shares: num(first(item.shareCount, item.shares)),
      saves: num(first(item.collectCount, item.saves, item.collect)),
    },
    creator,
    sound,
    raw: item,
  };
}

// ---------------------------------------------------------------------------
// Instagram (apify/instagram-post-scraper / instagram-hashtag-scraper shape)
// ---------------------------------------------------------------------------

export function parseInstagramItem(item: Item): CollectedPost | null {
  const id = str(first(item.id, item.shortCode));
  if (!id) return null;

  const shortCode = str(item.shortCode);
  const owner = asObj(item.owner);
  const username = str(
    first(item.ownerUsername, owner?.username, item.username)
  );

  const creator: CollectedCreator | undefined = username
    ? {
        username,
        platformUserId: str(first(item.ownerId, owner?.id)),
        displayName: str(first(item.ownerFullName, owner?.fullName, owner?.full_name)),
        avatarUrl: str(first(item.ownerProfilePicUrl, owner?.profilePicUrl)),
        verified: bool(first(item.isVerified, owner?.isVerified, owner?.is_verified)),
        followers: num(first(item.ownerFollowers, owner?.followersCount, owner?.followers)),
      }
    : undefined;

  const music = asObj(item.musicInfo) ?? asObj(item.clipsMetadata);
  const soundName = str(first(music?.songName, music?.song_name, music?.title));
  const soundArtist = str(first(music?.artistName, music?.display_artist, music?.artist));
  // IG reels audio tracks have music_id / audio_id when it's a catalog track
  const soundId = str(
    first(music?.audioId, music?.audio_id, music?.musicId, item.audioId)
  );
  const sound: CollectedSound | undefined = soundId
    ? {
        platformSoundId: soundId,
        title: soundName,
        artist: soundArtist,
        isOriginalAudio: !soundName, // no title => original/reused audio
      }
    : undefined;

  const caption = str(first(item.caption, item.text));
  const isVideo = bool(first(item.isVideo, item.is_video)) || item.type === "Video";

  return {
    platformPostId: id,
    url:
      str(item.url) ??
      (shortCode ? `https://www.instagram.com/reel/${shortCode}/` : `https://www.instagram.com/p/${id}/`),
    caption,
    hashtags: extractHashtags(item, caption),
    mentions: extractMentions(item, caption),
    postedAt: parseDate(first(item.timestamp, item.takenAt, item.taken_at_timestamp, item.createdAt)),
    durationSec: num(first(item.videoDuration, item.video_duration)) || undefined,
    coverUrl: str(first(item.displayUrl, item.display_url, item.thumbnailUrl)),
    metrics: {
      views: BigInt(
        Math.round(
          num(
            first(
              item.videoViewCount,
              item.videoPlayCount,
              item.playCount,
              item.views,
              isVideo ? item.viewCount : undefined
            )
          )
        )
      ),
      likes: num(first(item.likesCount, item.likes, item.likeCount)),
      comments: num(first(item.commentsCount, item.comments)),
      shares: num(first(item.sharesCount, item.shares)),
      saves: num(first(item.savesCount, item.saves)),
    },
    creator,
    sound,
    raw: item,
  };
}
