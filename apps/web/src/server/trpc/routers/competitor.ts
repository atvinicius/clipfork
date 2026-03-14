import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import { Queue } from "bullmq";
import IORedis from "ioredis";

function getMonitorQueue() {
  const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
  return new Queue("monitor", {
    connection: redis as unknown as import("bullmq").ConnectionOptions,
  });
}

function getCloneQueue() {
  const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
  return new Queue("clone", {
    connection: redis as unknown as import("bullmq").ConnectionOptions,
  });
}

export const competitorRouter = router({
  createWatch: protectedProcedure
    .input(
      z.object({
        type: z.enum(["ACCOUNT", "HASHTAG", "KEYWORD"]),
        platform: z.enum(["TIKTOK", "INSTAGRAM"]),
        value: z.string().min(1).max(200),
        frequency: z.enum(["DAILY", "TWICE_DAILY", "WEEKLY"]).default("DAILY"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const watch = await ctx.prisma.competitorWatch.create({
        data: {
          orgId: ctx.org.id,
          type: input.type,
          platform: input.platform,
          value: input.value,
          scanFrequency: input.frequency,
        },
      });
      return {
        ...watch,
        active: watch.isActive,
        frequency: watch.scanFrequency,
      };
    }),

  listWatches: protectedProcedure.query(async ({ ctx }) => {
    const watches = await ctx.prisma.competitorWatch.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    });

    return watches.map((w) => ({
      id: w.id,
      orgId: w.orgId,
      type: w.type,
      platform: w.platform,
      value: w.value,
      frequency: w.scanFrequency,
      active: w.isActive,
      lastScannedAt: w.lastScannedAt,
      createdAt: w.createdAt,
      postCount: w._count.posts,
    }));
  }),

  toggleWatch: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        active: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const watch = await ctx.prisma.competitorWatch.update({
        where: {
          id: input.id,
          orgId: ctx.org.id,
        },
        data: { isActive: input.active },
      });
      return { ...watch, active: watch.isActive, frequency: watch.scanFrequency };
    }),

  deleteWatch: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.competitorPost.deleteMany({
        where: {
          watchId: input.id,
          watch: { orgId: ctx.org.id },
        },
      });
      return ctx.prisma.competitorWatch.delete({
        where: {
          id: input.id,
          orgId: ctx.org.id,
        },
      });
    }),

  listPosts: protectedProcedure
    .input(
      z.object({
        watchId: z.string(),
        outlierOnly: z.boolean().default(false),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const watch = await ctx.prisma.competitorWatch.findFirst({
        where: { id: input.watchId, orgId: ctx.org.id },
      });
      if (!watch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Watch not found",
        });
      }

      const posts = await ctx.prisma.competitorPost.findMany({
        where: {
          watchId: input.watchId,
          ...(input.outlierOnly ? { isOutlier: true } : {}),
        },
        orderBy: { engagementRate: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (posts.length > input.limit) {
        const next = posts.pop();
        nextCursor = next?.id;
      }

      return { posts, nextCursor };
    }),

  getOutliers: protectedProcedure
    .input(
      z.object({
        sortBy: z
          .enum(["engagementRate", "discoveredAt", "views"])
          .default("engagementRate"),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orderBy =
        input.sortBy === "engagementRate"
          ? { engagementRate: "desc" as const }
          : input.sortBy === "views"
            ? { views: "desc" as const }
            : { discoveredAt: "desc" as const };

      const posts = await ctx.prisma.competitorPost.findMany({
        where: {
          isOutlier: true,
          watch: { orgId: ctx.org.id },
        },
        orderBy,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          watch: {
            select: {
              platform: true,
              type: true,
              value: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (posts.length > input.limit) {
        const next = posts.pop();
        nextCursor = next?.id;
      }

      // Return flattened shape expected by the UI
      return posts.map((p) => ({
        id: p.id,
        url: p.url,
        views: p.views,
        likes: p.likes,
        shares: p.shares,
        comments: p.comments,
        engagementRate: p.engagementRate,
        discoveredAt: p.discoveredAt,
        platform: p.watch.platform,
        caption: null as string | null,
        thumbnailUrl: null as string | null,
        watchValue: p.watch.value,
      }));
    }),

  triggerScan: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const watch = await ctx.prisma.competitorWatch.findFirst({
        where: { id: input.id, orgId: ctx.org.id },
      });
      if (!watch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Watch not found",
        });
      }

      const queue = getMonitorQueue();
      await queue.add(`scan-${watch.id}`, { watchId: watch.id });
      await queue.close();

      return { queued: true };
    }),

  clonePost: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.competitorPost.findFirst({
        where: {
          id: input.postId,
          watch: { orgId: ctx.org.id },
        },
        include: { watch: true },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }

      const queue = getCloneQueue();
      await queue.add(`clone-${post.id}`, {
        postId: post.id,
        postUrl: post.url,
        watchId: post.watchId,
        orgId: ctx.org.id,
      });
      await queue.close();

      return { queued: true };
    }),
});
