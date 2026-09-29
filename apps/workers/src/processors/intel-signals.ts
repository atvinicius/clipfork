import { prisma, Prisma } from "@ugc/db";
import {
  engagementRate,
  viewVelocity,
  viewDelta,
  viralityScore,
  isViralOutlier,
  median,
  growthRate,
} from "../intel/scoring";
import { intelConfig } from "../intel/config";

// ---------------------------------------------------------------------------
// intel-signals (cron): turns snapshots into intelligence.
//   1. Per-post velocity + engagement + virality score (72h snapshot window)
//   2. Creator median baselines + VIRAL_POST outlier signals
//   3. RISING_SOUND — usage growth of a sound, 48h vs prior 48h
//   4. CREATOR_BREAKOUT — follower growth over 7d
//   5. HASHTAG_TREND — hashtag post volume + velocity growth, 48h vs prior
// Signals dedupe by (type, entity): an existing active signal is refreshed
// rather than duplicated, and stale ones deactivate.
// ---------------------------------------------------------------------------

const SIGNAL_STALE_HOURS = 72;
const POST_WINDOW_HOURS = 7 * 24;
const TREND_WINDOW_HOURS = 48;
const POST_BATCH = 2000;

type PostRow = {
  id: string;
  platform: "TIKTOK" | "INSTAGRAM" | "YOUTUBE";
  views: bigint;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
  velocityPerHour: number;
  viralityScore: number;
  isOutlier: boolean;
  postedAt: Date | null;
  creatorId: string | null;
  soundId: string | null;
  hashtags: string[];
};

async function refreshSignal(
  type: "VIRAL_POST" | "RISING_SOUND" | "CREATOR_BREAKOUT" | "HASHTAG_TREND",
  entity: { postId?: string; soundId?: string; creatorId?: string; hashtag?: string },
  platform: "TIKTOK" | "INSTAGRAM" | "YOUTUBE",
  score: number,
  payload: Record<string, unknown>
) {
  const where = {
    type,
    isActive: true,
    postId: entity.postId ?? null,
    soundId: entity.soundId ?? null,
    creatorId: entity.creatorId ?? null,
    hashtag: entity.hashtag ?? null,
  };
  const existing = await prisma.intelSignal.findFirst({ where, select: { id: true } });
  if (existing) {
    await prisma.intelSignal.update({
      where: { id: existing.id },
      data: { score, payload: payload as Prisma.InputJsonValue, lastSeenAt: new Date() },
    });
  } else {
    await prisma.intelSignal.create({
      data: { type, platform, score, payload: payload as Prisma.InputJsonValue, ...entity },
    });
  }
}

export async function processIntelSignalsJob() {
  const now = new Date();
  const postCutoff = new Date(now.getTime() - POST_WINDOW_HOURS * 3_600_000);
  const snapCutoff = new Date(now.getTime() - 72 * 3_600_000);
  const trendCut = new Date(now.getTime() - TREND_WINDOW_HOURS * 3_600_000);
  const trendPrevCut = new Date(now.getTime() - 2 * TREND_WINDOW_HOURS * 3_600_000);

  // ---- 1. velocity + virality for recently-seen posts --------------------
  const posts: PostRow[] = await prisma.intelPost.findMany({
    where: { lastSeenAt: { gte: postCutoff } },
    orderBy: { lastSeenAt: "desc" },
    take: POST_BATCH,
    select: {
      id: true, platform: true, views: true, likes: true, comments: true,
      shares: true, saves: true, engagementRate: true, velocityPerHour: true,
      viralityScore: true, isOutlier: true, postedAt: true, creatorId: true,
      soundId: true, hashtags: true,
    },
  });
  const postIds = posts.map((p) => p.id);

  const snapshots = postIds.length
    ? await prisma.intelPostSnapshot.findMany({
        where: { postId: { in: postIds }, bucket: { gte: snapCutoff } },
        orderBy: { bucket: "asc" },
        select: { postId: true, bucket: true, views: true },
      })
    : [];

  const snapsByPost = new Map<string, Array<{ collectedAt: Date; views: bigint }>>();
  for (const s of snapshots) {
    const arr = snapsByPost.get(s.postId) ?? [];
    arr.push({ collectedAt: s.bucket, views: s.views });
    snapsByPost.set(s.postId, arr);
  }

  // ---- 2. creator medians --------------------------------------------------
  const viewsByCreator = new Map<string, number[]>();
  for (const p of posts) {
    if (!p.creatorId) continue;
    const arr = viewsByCreator.get(p.creatorId) ?? [];
    arr.push(Number(p.views));
    viewsByCreator.set(p.creatorId, arr);
  }
  const creatorMedian = new Map<string, number>();
  for (const [cid, views] of viewsByCreator) {
    creatorMedian.set(cid, median(views));
  }
  for (const [cid, med] of creatorMedian) {
    await prisma.intelCreator.update({
      where: { id: cid },
      data: { medianViews: BigInt(Math.round(med)) },
    });
  }

  // ---- score + update posts, emit VIRAL_POST signals ------------------------
  const postUpdates: Array<ReturnType<typeof prisma.intelPost.update>> = [];
  let signals = 0;

  for (const p of posts) {
    const snaps = snapsByPost.get(p.id) ?? [];
    const velocity = viewVelocity(snaps);
    const er = engagementRate({
      views: p.views, likes: p.likes, comments: p.comments,
      shares: p.shares, saves: p.saves,
    });
    const ageHours = p.postedAt
      ? (now.getTime() - p.postedAt.getTime()) / 3_600_000
      : (now.getTime() - postCutoff.getTime()) / 3_600_000;
    const score = viralityScore({
      velocityPerHour: velocity, engagementRate: er, ageHours,
    });
    const outlier = isViralOutlier(
      Number(p.views),
      p.creatorId ? creatorMedian.get(p.creatorId) ?? 0 : 0
    );

    const changed =
      Math.abs(velocity - p.velocityPerHour) > 0.5 ||
      Math.abs(score - p.viralityScore) > 0.01 ||
      Math.abs(er - p.engagementRate) > 0.05 ||
      outlier !== p.isOutlier;
    if (changed) {
      postUpdates.push(
        prisma.intelPost.update({
          where: { id: p.id },
          data: {
            velocityPerHour: velocity,
            viralityScore: score,
            engagementRate: er,
            isOutlier: outlier,
          },
        })
      );
    }

    if (outlier) {
      const med = p.creatorId ? creatorMedian.get(p.creatorId) ?? 0 : 0;
      await refreshSignal(
        "VIRAL_POST",
        { postId: p.id },
        p.platform,
        score,
        {
          views: Number(p.views),
          velocityPerHour: Math.round(velocity),
          engagementRate: Number(er.toFixed(2)),
          creatorMedianViews: med,
          multiple: med > 0 ? Number((Number(p.views) / med).toFixed(1)) : null,
        }
      );
      signals += 1;
    }
  }

  for (let i = 0; i < postUpdates.length; i += 200) {
    await prisma.$transaction(postUpdates.slice(i, i + 200));
  }

  // ---- 3. RISING_SOUND ----------------------------------------------------
  const trendPosts = await prisma.intelPost.findMany({
    where: { lastSeenAt: { gte: trendPrevCut }, soundId: { not: null } },
    select: {
      soundId: true, platform: true, postedAt: true, firstSeenAt: true,
      velocityPerHour: true,
    },
  });

  const curBySound = new Map<string, { n: number; v: number; platform: string }>();
  const prevBySound = new Map<string, { n: number; v: number }>();
  for (const p of trendPosts) {
    const when = p.postedAt ?? p.firstSeenAt;
    const cur = when >= trendCut;
    const map = cur ? curBySound : prevBySound;
    const e = map.get(p.soundId!) ?? { n: 0, v: 0, ...(cur ? { platform: p.platform } : {}) };
    e.n += 1;
    e.v += p.velocityPerHour;
    map.set(p.soundId!, e);
  }

  for (const [soundId, cur] of curBySound) {
    if (cur.n < intelConfig.risingSoundMinPosts48h) continue;
    const prev = prevBySound.get(soundId) ?? { n: 0, v: 0 };
    const growth = growthRate(cur.n, prev.n);
    const capped = Number.isFinite(growth) ? growth : 10;
    if (capped < intelConfig.risingSoundMinGrowth && !(prev.n === 0 && cur.n >= 2 * intelConfig.risingSoundMinPosts48h)) continue;

    const score = Math.log1p(cur.v) * (1 + capped);
    await refreshSignal(
      "RISING_SOUND",
      { soundId },
      cur.platform as "TIKTOK" | "INSTAGRAM" | "YOUTUBE",
      score,
      { posts48h: cur.n, postsPrev48h: prev.n, growth: Number(capped.toFixed(2)), totalVelocity: Math.round(cur.v) }
    );
    signals += 1;
  }

  // ---- 4. CREATOR_BREAKOUT --------------------------------------------------
  const creatorSnaps = await prisma.intelCreatorSnapshot.findMany({
    where: { bucket: { gte: new Date(now.getTime() - 7 * 24 * 3_600_000) } },
    orderBy: { bucket: "asc" },
    select: { creatorId: true, bucket: true, followers: true, creator: { select: { platform: true } } },
  });
  const snapsByCreator = new Map<string, Array<{ followers: bigint; platform: string }>>();
  for (const s of creatorSnaps) {
    const arr = snapsByCreator.get(s.creatorId) ?? [];
    arr.push({ followers: s.followers, platform: s.creator.platform });
    snapsByCreator.set(s.creatorId, arr);
  }
  for (const [creatorId, arr] of snapsByCreator) {
    if (arr.length < 2) continue;
    const first = Number(arr[0]!.followers);
    const last = Number(arr[arr.length - 1]!.followers);
    const gain = last - first;
    const pct = first > 0 ? (gain / first) * 100 : 0;
    if (
      gain >= intelConfig.breakoutMinNewFollowers &&
      pct >= intelConfig.breakoutMinFollowerGrowthPct
    ) {
      await refreshSignal(
        "CREATOR_BREAKOUT",
        { creatorId },
        arr[0]!.platform as "TIKTOK" | "INSTAGRAM" | "YOUTUBE",
        Math.log1p(gain) * (1 + pct / 10),
        { newFollowers7d: gain, growthPct7d: Number(pct.toFixed(2)), followers: last }
      );
      signals += 1;
    }
  }

  // ---- 5. HASHTAG_TREND -----------------------------------------------------
  const hashtagPosts = await prisma.intelPost.findMany({
    where: { lastSeenAt: { gte: trendPrevCut }, hashtags: { isEmpty: false } },
    select: { hashtags: true, platform: true, postedAt: true, firstSeenAt: true, velocityPerHour: true },
  });
  const curByTag = new Map<string, { n: number; v: number; platform: string }>();
  const prevByTag = new Map<string, number>();
  for (const p of hashtagPosts) {
    const when = p.postedAt ?? p.firstSeenAt;
    const cur = when >= trendCut;
    for (const tag of p.hashtags) {
      if (cur) {
        const e = curByTag.get(tag) ?? { n: 0, v: 0, platform: p.platform };
        e.n += 1; e.v += p.velocityPerHour;
        curByTag.set(tag, e);
      } else {
        prevByTag.set(tag, (prevByTag.get(tag) ?? 0) + 1);
      }
    }
  }
  for (const [tag, cur] of curByTag) {
    if (cur.n < intelConfig.hashtagTrendMinPosts) continue;
    const prevN = prevByTag.get(tag) ?? 0;
    const growth = growthRate(cur.n, prevN);
    const capped = Number.isFinite(growth) ? growth : 10;
    if (capped < 0.3) continue;
    await refreshSignal(
      "HASHTAG_TREND",
      { hashtag: tag },
      cur.platform as "TIKTOK" | "INSTAGRAM" | "YOUTUBE",
      Math.log1p(cur.v) * (1 + capped),
      { posts48h: cur.n, postsPrev48h: prevN, growth: Number(capped.toFixed(2)), totalVelocity: Math.round(cur.v) }
    );
    signals += 1;
  }

  // ---- retire stale signals -------------------------------------------------
  const staleCut = new Date(now.getTime() - SIGNAL_STALE_HOURS * 3_600_000);
  const retired = await prisma.intelSignal.updateMany({
    where: { isActive: true, lastSeenAt: { lt: staleCut } },
    data: { isActive: false },
  });

  console.log(
    `[intel-signals] scored ${posts.length} posts, refreshed ${signals} signals, retired ${retired.count}`
  );
  return { postsScored: posts.length, signals, retired: retired.count };
}
