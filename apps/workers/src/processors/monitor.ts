import { Job } from "bullmq";
import { ApifyClient } from "apify-client";
import { prisma } from "@ugc/db";
import { cloneQueue } from "../queues";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonitorJobData {
  watchId: string;
}

interface ParsedPost {
  platformPostId: string;
  url: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
}

// ---------------------------------------------------------------------------
// Apify actor runners
// ---------------------------------------------------------------------------

function getApifyClient(): ApifyClient {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not set");
  return new ApifyClient({ token });
}

async function scrapeTikTokAccount(handle: string): Promise<ParsedPost[]> {
  const client = getApifyClient();

  const run = await client.actor("clockworks/free-tiktok-scraper").call({
    profiles: [handle],
    resultsPerPage: 30,
    shouldDownloadVideos: false,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  return items
    .filter((item: Record<string, unknown>) => item.id)
    .map((item: Record<string, unknown>) => ({
      platformPostId: String(item.id ?? ""),
      url: String(item.webVideoUrl ?? item.url ?? `https://www.tiktok.com/@${handle}/video/${item.id}`),
      views: Number(item.playCount ?? item.views ?? 0),
      likes: Number(item.diggCount ?? item.likes ?? 0),
      shares: Number(item.shareCount ?? item.shares ?? 0),
      comments: Number(item.commentCount ?? item.comments ?? 0),
    }));
}

async function scrapeInstagramAccount(handle: string): Promise<ParsedPost[]> {
  const client = getApifyClient();

  const run = await client.actor("apify/instagram-post-scraper").call({
    username: [handle],
    resultsLimit: 30,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  return items
    .filter((item: Record<string, unknown>) => item.id || item.shortCode)
    .map((item: Record<string, unknown>) => ({
      platformPostId: String(item.id ?? item.shortCode ?? ""),
      url: String(item.url ?? `https://www.instagram.com/p/${item.shortCode}/`),
      views: Number(item.videoViewCount ?? item.videoPlayCount ?? 0),
      likes: Number(item.likesCount ?? item.likes ?? 0),
      shares: Number(item.sharesCount ?? 0),
      comments: Number(item.commentsCount ?? item.comments ?? 0),
    }));
}

async function scrapeTikTokHashtag(hashtag: string): Promise<ParsedPost[]> {
  const client = getApifyClient();

  const run = await client.actor("clockworks/free-tiktok-scraper").call({
    hashtags: [hashtag],
    resultsPerPage: 30,
    shouldDownloadVideos: false,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  return items
    .filter((item: Record<string, unknown>) => item.id)
    .map((item: Record<string, unknown>) => ({
      platformPostId: String(item.id ?? ""),
      url: String(item.webVideoUrl ?? item.url ?? ""),
      views: Number(item.playCount ?? item.views ?? 0),
      likes: Number(item.diggCount ?? item.likes ?? 0),
      shares: Number(item.shareCount ?? item.shares ?? 0),
      comments: Number(item.commentCount ?? item.comments ?? 0),
    }));
}

async function scrapeTikTokKeyword(keyword: string): Promise<ParsedPost[]> {
  const client = getApifyClient();

  const run = await client.actor("clockworks/free-tiktok-scraper").call({
    searchQueries: [keyword],
    resultsPerPage: 30,
    shouldDownloadVideos: false,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  return items
    .filter((item: Record<string, unknown>) => item.id)
    .map((item: Record<string, unknown>) => ({
      platformPostId: String(item.id ?? ""),
      url: String(item.webVideoUrl ?? item.url ?? ""),
      views: Number(item.playCount ?? item.views ?? 0),
      likes: Number(item.diggCount ?? item.likes ?? 0),
      shares: Number(item.shareCount ?? item.shares ?? 0),
      comments: Number(item.commentCount ?? item.comments ?? 0),
    }));
}

// ---------------------------------------------------------------------------
// Engagement helpers
// ---------------------------------------------------------------------------

function calculateEngagementRate(post: ParsedPost): number {
  const totalEngagements = post.likes + post.shares + post.comments;
  if (post.views === 0) return 0;
  return (totalEngagements / post.views) * 100;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processMonitorJob(job: Job<MonitorJobData>) {
  const { watchId } = job.data;

  console.log(`[monitor] Processing watch ${watchId}`);

  const watch = await prisma.competitorWatch.findUnique({
    where: { id: watchId },
  });

  if (!watch || !watch.isActive) {
    console.log(`[monitor] Watch ${watchId} not found or inactive, skipping`);
    return;
  }

  // Scrape posts based on platform + type
  let posts: ParsedPost[] = [];

  try {
    if (watch.platform === "TIKTOK") {
      if (watch.type === "ACCOUNT") {
        posts = await scrapeTikTokAccount(watch.value);
      } else if (watch.type === "HASHTAG") {
        posts = await scrapeTikTokHashtag(watch.value);
      } else if (watch.type === "KEYWORD") {
        posts = await scrapeTikTokKeyword(watch.value);
      }
    } else if (watch.platform === "INSTAGRAM") {
      if (watch.type === "ACCOUNT") {
        posts = await scrapeInstagramAccount(watch.value);
      } else {
        console.warn(`[monitor] Instagram ${watch.type} scraping not supported yet`);
        return;
      }
    }
  } catch (err) {
    console.error(`[monitor] Failed to scrape for watch ${watchId}:`, err);
    throw err;
  }

  if (posts.length === 0) {
    console.log(`[monitor] No posts found for watch ${watchId}`);
    await prisma.competitorWatch.update({
      where: { id: watchId },
      data: { lastScannedAt: new Date() },
    });
    return;
  }

  // Calculate engagement rates
  const postsWithEngagement = posts.map((p) => ({
    ...p,
    engagementRate: calculateEngagementRate(p),
  }));

  // Upsert competitor posts
  for (const post of postsWithEngagement) {
    await prisma.competitorPost.upsert({
      where: {
        watchId_platformPostId: {
          watchId: watch.id,
          platformPostId: post.platformPostId,
        },
      },
      create: {
        watchId: watch.id,
        platformPostId: post.platformPostId,
        url: post.url,
        views: post.views,
        likes: post.likes,
        shares: post.shares,
        comments: post.comments,
        engagementRate: post.engagementRate,
        isOutlier: false,
      },
      update: {
        views: post.views,
        likes: post.likes,
        shares: post.shares,
        comments: post.comments,
        engagementRate: post.engagementRate,
      },
    });
  }

  // Calculate average engagement rate and flag outliers
  const avgEngagement =
    postsWithEngagement.reduce((sum, p) => sum + p.engagementRate, 0) /
    postsWithEngagement.length;

  const outlierThreshold = avgEngagement * 3;

  // Get all posts for this watch to re-evaluate outliers
  const allPosts = await prisma.competitorPost.findMany({
    where: { watchId: watch.id },
  });

  const overallAvg =
    allPosts.reduce((sum, p) => sum + p.engagementRate, 0) / allPosts.length;
  const threshold = overallAvg * 3;

  for (const post of allPosts) {
    const shouldBeOutlier = post.engagementRate > threshold;
    if (post.isOutlier !== shouldBeOutlier) {
      await prisma.competitorPost.update({
        where: { id: post.id },
        data: { isOutlier: shouldBeOutlier },
      });

      // If newly flagged as outlier, enqueue clone-analyze job
      if (shouldBeOutlier && !post.isOutlier) {
        console.log(
          `[monitor] Outlier detected: ${post.url} (engagement: ${post.engagementRate.toFixed(2)}%, avg: ${overallAvg.toFixed(2)}%)`
        );
        await cloneQueue.add(`clone-analyze-${post.id}`, {
          postId: post.id,
          postUrl: post.url,
          watchId: watch.id,
          orgId: watch.orgId,
        });
      }
    }
  }

  // Update last scanned timestamp
  await prisma.competitorWatch.update({
    where: { id: watchId },
    data: { lastScannedAt: new Date() },
  });

  console.log(
    `[monitor] Watch ${watchId} scan complete: ${posts.length} posts processed, avg engagement: ${avgEngagement.toFixed(2)}%`
  );

  return {
    watchId,
    postsProcessed: posts.length,
    avgEngagement,
    outlierThreshold: threshold,
  };
}
