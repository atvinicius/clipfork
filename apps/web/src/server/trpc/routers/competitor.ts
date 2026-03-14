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
        scanFrequency: z.enum(["DAILY", "TWICE_DAILY", "WEEKLY"]).default("DAILY"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.competitorWatch.create({
        data: {
          orgId: ctx.org.id,
          type: input.type,
          platform: input.platform,
          value: input.value,
          scanFrequency: input.scanFrequency,
        },
      });
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
      ...w,
      postCount: w._count.posts,
    }));
  }),

  toggleWatch: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.competitorWatch.update({
        where: {
          id: input.id,
          orgId: ctx.org.id,
        },
        data: { isActive: input.isActive },
      });
    }),

  deleteWatch: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Delete associated posts first (cascade should handle, but be explicit)
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
      // Verify the watch belongs to this org
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

      return { posts, nextCursor };
    }),

  triggerScan: protectedProcedure
    .input(z.object({ watchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const watch = await ctx.prisma.competitorWatch.findFirst({
        where: { id: input.watchId, orgId: ctx.org.id },
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
