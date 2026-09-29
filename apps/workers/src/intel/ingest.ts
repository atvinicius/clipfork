import { prisma, Prisma } from "@ugc/db";
import type { CollectedPost, CollectedSound, CollectedCreator } from "./types";
import { engagementRate, hourBucket } from "./scoring";

// ---------------------------------------------------------------------------
// Ingest: write normalized CollectedPosts into the intel schema. Idempotent —
// creators/sounds/posts upsert on natural keys, snapshots dedupe on the
// hourly bucket, so re-crawls refresh stats instead of duplicating rows.
// ---------------------------------------------------------------------------

export interface IngestResult {
  itemsFound: number;
  newPosts: number;
  newCreators: number;
  newSounds: number;
  postIds: string[];
  /** Newly-seen posts worth downloading, sorted by views desc. */
  candidates: Array<{ postId: string; views: bigint; isNew: boolean }>;
}

async function upsertCreator(
  platform: "TIKTOK" | "INSTAGRAM" | "YOUTUBE",
  c: CollectedCreator,
  bucket: Date
): Promise<{ id: string; isNew: boolean }> {
  const existing = await prisma.intelCreator.findUnique({
    where: { platform_username: { platform, username: c.username } },
    select: { id: true },
  });

  const data = {
    platformUserId: c.platformUserId,
    displayName: c.displayName,
    avatarUrl: c.avatarUrl,
    verified: c.verified,
    followers: BigInt(c.followers ?? 0),
    following: c.following ?? 0,
    likesTotal: BigInt(c.likesTotal ?? 0),
    videoCount: c.videoCount ?? 0,
    lastSeenAt: new Date(),
  };

  let id: string;
  if (existing) {
    await prisma.intelCreator.update({ where: { id: existing.id }, data });
    id = existing.id;
  } else {
    const created = await prisma.intelCreator.create({
      data: { platform, username: c.username, ...data },
      select: { id: true },
    });
    id = created.id;
  }

  // Follower snapshot (deduped by hour bucket — latest count wins)
  await prisma.intelCreatorSnapshot.upsert({
    where: { creatorId_bucket: { creatorId: id, bucket } },
    create: {
      creatorId: id,
      bucket,
      followers: BigInt(c.followers ?? 0),
      following: c.following ?? 0,
      likesTotal: BigInt(c.likesTotal ?? 0),
      videoCount: c.videoCount ?? 0,
    },
    update: {
      followers: BigInt(c.followers ?? 0),
      following: c.following ?? 0,
      likesTotal: BigInt(c.likesTotal ?? 0),
      videoCount: c.videoCount ?? 0,
    },
  });

  return { id, isNew: !existing };
}

async function upsertSound(
  platform: "TIKTOK" | "INSTAGRAM" | "YOUTUBE",
  s: CollectedSound
): Promise<{ id: string; isNew: boolean }> {
  const existing = await prisma.intelSound.findUnique({
    where: {
      platform_platformSoundId: {
        platform,
        platformSoundId: s.platformSoundId,
      },
    },
    select: { id: true },
  });

  const data = {
    title: s.title,
    artist: s.artist,
    durationSec: s.durationSec,
    isOriginalAudio: s.isOriginalAudio,
    usageCount: BigInt(s.usageCount ?? 0),
    coverUrl: s.coverUrl,
    lastSeenAt: new Date(),
    // Scraper-provided identity counts as metadata identification
    identifiedVia: s.title ? "metadata" : undefined,
  };

  if (existing) {
    await prisma.intelSound.update({ where: { id: existing.id }, data });
    return { id: existing.id, isNew: false };
  }
  const created = await prisma.intelSound.create({
    data: {
      platform,
      platformSoundId: s.platformSoundId,
      ...data,
      identifiedVia: s.title ? "metadata" : null,
    },
    select: { id: true },
  });
  return { id: created.id, isNew: true };
}

export async function ingestCollectedPosts(
  platform: "TIKTOK" | "INSTAGRAM" | "YOUTUBE",
  targetId: string,
  posts: CollectedPost[]
): Promise<IngestResult> {
  const bucket = hourBucket(new Date());
  const result: IngestResult = {
    itemsFound: posts.length,
    newPosts: 0,
    newCreators: 0,
    newSounds: 0,
    postIds: [],
    candidates: [],
  };

  for (const p of posts) {
    const creatorRow = p.creator
      ? await upsertCreator(platform, p.creator, bucket)
      : null;
    if (creatorRow?.isNew) result.newCreators += 1;

    const soundRow = p.sound ? await upsertSound(platform, p.sound) : null;
    if (soundRow?.isNew) result.newSounds += 1;

    const er = engagementRate(p.metrics);
    const postData = {
      url: p.url,
      creatorId: creatorRow?.id ?? null,
      soundId: soundRow?.id ?? null,
      caption: p.caption,
      hashtags: p.hashtags,
      mentions: p.mentions,
      postedAt: p.postedAt,
      durationSec: p.durationSec,
      views: p.metrics.views,
      likes: p.metrics.likes,
      comments: p.metrics.comments,
      shares: p.metrics.shares,
      saves: p.metrics.saves,
      engagementRate: er,
      coverUrl: p.coverUrl,
      rawJson: p.raw as Prisma.InputJsonValue,
      lastSeenAt: new Date(),
    };

    const post = await prisma.intelPost.upsert({
      where: {
        platform_platformPostId: {
          platform,
          platformPostId: p.platformPostId,
        },
      },
      create: { platform, platformPostId: p.platformPostId, ...postData },
      update: postData,
      select: { id: true, createdAt: true, views: true },
    });

    // createdAt within this same second => first time we saw it
    const isNew = Date.now() - post.createdAt.getTime() < 10_000;
    if (isNew) result.newPosts += 1;
    result.postIds.push(post.id);
    result.candidates.push({ postId: post.id, views: post.views, isNew });

    await prisma.intelPostSnapshot.upsert({
      where: { postId_bucket: { postId: post.id, bucket } },
      create: {
        postId: post.id,
        bucket,
        views: p.metrics.views,
        likes: p.metrics.likes,
        comments: p.metrics.comments,
        shares: p.metrics.shares,
        saves: p.metrics.saves,
      },
      update: {
        views: p.metrics.views,
        likes: p.metrics.likes,
        comments: p.metrics.comments,
        shares: p.metrics.shares,
        saves: p.metrics.saves,
      },
    });

    await prisma.intelPostTarget.upsert({
      where: { postId_targetId: { postId: post.id, targetId } },
      create: { postId: post.id, targetId },
      update: {},
    });
  }

  result.candidates.sort((a, b) =>
    a.views === b.views ? 0 : a.views > b.views ? -1 : 1
  );
  return result;
}
