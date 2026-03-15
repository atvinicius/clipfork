import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { calculateVideoCredits, canAfford } from "@ugc/shared";

export const videoRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        productUrl: z.string().url().optional(),
        productId: z.string().optional(),
        videoType: z.enum(["TALKING_HEAD", "FACELESS"]),
        brandKitId: z.string().optional(),
        presetId: z.string().optional(),
        avatarId: z.string().optional(),
        voiceId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const credits = calculateVideoCredits(5);
      if (!canAfford(ctx.org.creditsBalance, credits)) {
        throw new Error("Insufficient credits");
      }

      const video = await ctx.prisma.video.create({
        data: {
          orgId: ctx.org.id,
          productId: input.productId,
          brandKitId: input.brandKitId,
          presetId: input.presetId,
          type: input.videoType,
          status: "QUEUED",
          avatarId: input.avatarId,
          voiceId: input.voiceId,
          creditsUsed: credits,
        },
      });

      // Deduct credits
      await ctx.prisma.$transaction([
        ctx.prisma.organization.update({
          where: { id: ctx.org.id },
          data: { creditsBalance: { decrement: credits } },
        }),
        ctx.prisma.creditTransaction.create({
          data: {
            orgId: ctx.org.id,
            amount: -credits,
            type: "USAGE",
            referenceId: video.id,
          },
        }),
      ]);

      // TODO: enqueue to BullMQ video pipeline
      return video;
    }),

  list: protectedProcedure
    .input(
      z.object({
        status: z
          .enum([
            "QUEUED",
            "SCRAPING",
            "SCRIPTING",
            "GENERATING_AUDIO",
            "GENERATING_SCENES",
            "COMPOSING",
            "COMPLETED",
            "FAILED",
          ])
          .optional(),
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const videos = await ctx.prisma.video.findMany({
        where: {
          orgId: ctx.org.id,
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { product: true, brandKit: true, preset: true },
      });

      let nextCursor: string | undefined;
      if (videos.length > input.limit) {
        const next = videos.pop();
        nextCursor = next?.id;
      }

      return { videos, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.video.findFirstOrThrow({
        where: { id: input.id, orgId: ctx.org.id },
        include: { product: true, brandKit: true, template: true, preset: true },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.video.delete({
        where: { id: input.id, orgId: ctx.org.id },
      });
    }),
});
