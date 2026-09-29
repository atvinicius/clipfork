import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@ugc/db";
import { sendJob } from "../../queue";

// ---------------------------------------------------------------------------
// Intelligence layer API. The corpus is global (shared across orgs) — targets
// are attributed to the creating org for audit but the data pool is shared.
// ---------------------------------------------------------------------------

const platformEnum = z.enum(["TIKTOK", "INSTAGRAM"]);
const targetTypeEnum = z.enum(["ACCOUNT", "HASHTAG", "SOUND", "KEYWORD"]);
const windowEnum = z.enum(["24h", "48h", "7d", "30d"]);

function windowCutoff(w: "24h" | "48h" | "7d" | "30d"): Date {
  const hours = { "24h": 24, "48h": 48, "7d": 168, "30d": 720 }[w];
  return new Date(Date.now() - hours * 3_600_000);
}

function normalizeTargetValue(type: string, value: string): string {
  const v = value.trim();
  if (type === "ACCOUNT") return v.replace(/^@/, "");
  if (type === "HASHTAG") return v.replace(/^#/, "").toLowerCase();
  return v;
}

export const intelRouter = router({
  // ---------------------------------------------------------------------
  // Overview stats
  // ---------------------------------------------------------------------
  overview: protectedProcedure.query(async ({ ctx }) => {
    const [posts, creators, sounds, targets, activeSignals, last24h] =
      await Promise.all([
        ctx.prisma.intelPost.count(),
        ctx.prisma.intelCreator.count(),
        ctx.prisma.intelSound.count(),
        ctx.prisma.intelTarget.count({ where: { isActive: true } }),
        ctx.prisma.intelSignal.count({ where: { isActive: true } }),
        ctx.prisma.intelPost.count({
          where: { firstSeenAt: { gte: new Date(Date.now() - 86_400_000) } },
        }),
      ]);
    return { posts, creators, sounds, targets, activeSignals, newPosts24h: last24h };
  }),

  // ---------------------------------------------------------------------
  // Targets (collection drivers)
  // ---------------------------------------------------------------------
  listTargets: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.intelTarget.findMany({
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { posts: true, crawlRuns: true } },
      },
    });
  }),

  createTarget: protectedProcedure
    .input(
      z.object({
        type: targetTypeEnum,
        platform: platformEnum,
        value: z.string().min(1).max(300),
        crawlFrequencyMinutes: z.number().int().min(15).max(10080).default(360),
        priority: z.number().int().min(-10).max(10).default(0),
        downloadPolicy: z.enum(["NONE", "TOP_K", "VIRAL_ONLY", "ALL"]).default("VIRAL_ONLY"),
        downloadTopK: z.number().int().min(1).max(50).default(5),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const value = normalizeTargetValue(input.type, input.value);
      return ctx.prisma.intelTarget.upsert({
        where: {
          platform_type_value: {
            platform: input.platform,
            type: input.type,
            value,
          },
        },
        create: {
          type: input.type,
          platform: input.platform,
          value,
          crawlFrequencyMinutes: input.crawlFrequencyMinutes,
          priority: input.priority,
          downloadPolicy: input.downloadPolicy,
          downloadTopK: input.downloadTopK,
          createdByOrgId: ctx.org.id,
        },
        update: {
          isActive: true,
          crawlFrequencyMinutes: input.crawlFrequencyMinutes,
          priority: input.priority,
          downloadPolicy: input.downloadPolicy,
          downloadTopK: input.downloadTopK,
        },
      });
    }),

  updateTarget: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        isActive: z.boolean().optional(),
        priority: z.number().int().min(-10).max(10).optional(),
        crawlFrequencyMinutes: z.number().int().min(15).max(10080).optional(),
        downloadPolicy: z.enum(["NONE", "TOP_K", "VIRAL_ONLY", "ALL"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.intelTarget.update({ where: { id }, data });
    }),

  runTargetNow: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.intelTarget.update({
        where: { id: input.id },
        data: { nextCrawlAt: new Date() },
      });
    }),

  deleteTarget: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.intelTarget.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  listCrawlRuns: protectedProcedure
    .input(z.object({ targetId: z.string().optional(), limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.intelCrawlRun.findMany({
        where: input.targetId ? { targetId: input.targetId } : {},
        orderBy: { startedAt: "desc" },
        take: input.limit,
        include: {
          target: { select: { type: true, platform: true, value: true } },
        },
      });
    }),

  // ---------------------------------------------------------------------
  // Feeds
  // ---------------------------------------------------------------------
  feedPosts: protectedProcedure
    .input(
      z.object({
        platform: platformEnum.optional(),
        window: windowEnum.default("7d"),
        sort: z.enum(["VIRALITY", "VELOCITY", "VIEWS", "RECENT"]).default("VIRALITY"),
        outlierOnly: z.boolean().default(false),
        minViews: z.number().int().min(0).default(0),
        soundId: z.string().optional(),
        creatorId: z.string().optional(),
        limit: z.number().min(1).max(100).default(30),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orderBy =
        input.sort === "VIEWS"
          ? { views: "desc" as const }
          : input.sort === "VELOCITY"
            ? { velocityPerHour: "desc" as const }
            : input.sort === "RECENT"
              ? { postedAt: "desc" as const }
              : { viralityScore: "desc" as const };

      const posts = await ctx.prisma.intelPost.findMany({
        where: {
          ...(input.platform ? { platform: input.platform } : {}),
          ...(input.soundId ? { soundId: input.soundId } : {}),
          ...(input.creatorId ? { creatorId: input.creatorId } : {}),
          ...(input.outlierOnly ? { isOutlier: true } : {}),
          views: { gte: BigInt(input.minViews) },
          lastSeenAt: { gte: windowCutoff(input.window) },
        },
        orderBy,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          creator: { select: { username: true, displayName: true, followers: true, avatarUrl: true } },
          sound: { select: { title: true, artist: true, platformSoundId: true } },
        },
      });

      let nextCursor: string | undefined;
      if (posts.length > input.limit) nextCursor = posts.pop()?.id;
      return { posts, nextCursor };
    }),

  trendingSounds: protectedProcedure
    .input(
      z.object({
        platform: platformEnum.optional(),
        window: z.enum(["48h", "7d"]).default("48h"),
        limit: z.number().min(1).max(100).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const hours = input.window === "48h" ? 48 : 168;
      // Aggregate the corpus in SQL — this is the "which sound is taking off"
      // query, scored by post count + accumulated view velocity.
      return ctx.prisma.$queryRaw<
        Array<{
          id: string;
          platform: string;
          title: string | null;
          artist: string | null;
          platformSoundId: string;
          isOriginalAudio: boolean;
          usageCount: bigint;
          externalUrl: string | null;
          postsN: number;
          velocity: number;
          avgEngagement: number;
        }>
      >(Prisma.sql`
        SELECT s.id, s.platform::text, s.title, s.artist, s."platformSoundId",
               s."isOriginalAudio", s."usageCount", s."externalUrl",
               COUNT(p.id)::int AS "postsN",
               COALESCE(SUM(p."velocityPerHour"), 0)::float AS velocity,
               COALESCE(AVG(p."engagementRate"), 0)::float AS "avgEngagement"
        FROM "IntelSound" s
        JOIN "IntelPost" p ON p."soundId" = s.id
        WHERE p."lastSeenAt" >= NOW() - (${hours} || ' hours')::interval
          ${input.platform ? Prisma.sql`AND s.platform = ${input.platform}::"Platform"` : Prisma.empty}
        GROUP BY s.id
        ORDER BY velocity DESC
        LIMIT ${input.limit}
      `);
    }),

  topCreators: protectedProcedure
    .input(
      z.object({
        platform: platformEnum.optional(),
        sort: z.enum(["FOLLOWERS", "GROWTH", "MEDIAN_VIEWS"]).default("GROWTH"),
        limit: z.number().min(1).max(100).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.sort === "GROWTH") {
        // 7-day follower delta from snapshots
        return ctx.prisma.$queryRaw<
          Array<{
            id: string;
            platform: string;
            username: string;
            displayName: string | null;
            followers: bigint;
            verified: boolean;
            medianViews: bigint;
            gained7d: number;
          }>
        >(Prisma.sql`
          SELECT c.id, c.platform::text, c.username, c."displayName",
                 c.followers, c.verified, c."medianViews",
                 (c.followers - COALESCE(first_snap.followers, c.followers))::bigint AS "gained7d"
          FROM "IntelCreator" c
          LEFT JOIN LATERAL (
            SELECT followers FROM "IntelCreatorSnapshot" s
            WHERE s."creatorId" = c.id
              AND s.bucket <= NOW() - interval '6 days'
            ORDER BY s.bucket ASC LIMIT 1
          ) first_snap ON true
          ${input.platform ? Prisma.sql`WHERE c.platform = ${input.platform}::"Platform"` : Prisma.empty}
          ORDER BY "gained7d" DESC
          LIMIT ${input.limit}
        `);
      }
      return ctx.prisma.intelCreator.findMany({
        where: input.platform ? { platform: input.platform } : {},
        orderBy:
          input.sort === "FOLLOWERS"
            ? { followers: "desc" }
            : { medianViews: "desc" },
        take: input.limit,
        select: {
          id: true, platform: true, username: true, displayName: true,
          followers: true, verified: true, medianViews: true, avatarUrl: true,
        },
      }).then((rows) => rows.map((r) => ({ ...r, gained7d: null as number | null })));
    }),

  listSignals: protectedProcedure
    .input(
      z.object({
        type: z.enum(["VIRAL_POST", "RISING_SOUND", "CREATOR_BREAKOUT", "HASHTAG_TREND"]).optional(),
        platform: platformEnum.optional(),
        activeOnly: z.boolean().default(true),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.intelSignal.findMany({
        where: {
          ...(input.type ? { type: input.type } : {}),
          ...(input.platform ? { platform: input.platform } : {}),
          ...(input.activeOnly ? { isActive: true } : {}),
        },
        orderBy: { score: "desc" },
        take: input.limit,
        include: {
          post: { select: { url: true, caption: true, coverUrl: true, views: true } },
          sound: { select: { title: true, artist: true, platformSoundId: true } },
          creator: { select: { username: true, displayName: true, followers: true } },
        },
      });
    }),

  // ---------------------------------------------------------------------
  // Detail views
  // ---------------------------------------------------------------------
  postDetail: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.prisma.intelPost.findUnique({
        where: { id: input.id },
        include: {
          creator: true,
          sound: true,
          targets: { include: { target: { select: { type: true, value: true, platform: true } } } },
          snapshots: { orderBy: { bucket: "asc" }, take: 500 },
        },
      });
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      return post;
    }),

  soundDetail: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const sound = await ctx.prisma.intelSound.findUnique({
        where: { id: input.id },
        include: {
          posts: {
            orderBy: { viralityScore: "desc" },
            take: 20,
            include: {
              creator: { select: { username: true } },
            },
          },
          signals: { where: { isActive: true } },
        },
      });
      if (!sound) throw new TRPCError({ code: "NOT_FOUND" });
      return sound;
    }),

  creatorDetail: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const creator = await ctx.prisma.intelCreator.findUnique({
        where: { id: input.id },
        include: {
          posts: { orderBy: { viralityScore: "desc" }, take: 30 },
          snapshots: { orderBy: { bucket: "asc" }, take: 500 },
          signals: { where: { isActive: true } },
        },
      });
      if (!creator) throw new TRPCError({ code: "NOT_FOUND" });
      return creator;
    }),

  enqueueDownload: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.intelPost.findUnique({ where: { id: input.postId } });
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.intelPost.update({
        where: { id: post.id },
        data: { mediaStatus: "PENDING" },
      });
      await sendJob("intel-download", { postId: post.id });
      return { queued: true };
    }),
});
