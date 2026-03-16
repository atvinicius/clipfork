import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import { calculateVideoCredits, canAfford } from "@ugc/shared";
import { sendJob } from "../../queue";

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
      const orgId = ctx.org.id;
      const credits = calculateVideoCredits(5);
      if (!canAfford(ctx.org.creditsBalance, credits)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Insufficient credits: need ${credits}, have ${ctx.org.creditsBalance}`,
        });
      }

      // Resolve product URL from product record if not provided directly
      let productUrl = input.productUrl ?? "";
      if (!productUrl && input.productId) {
        const product = await ctx.prisma.product.findUnique({
          where: { id: input.productId },
        });
        productUrl = product?.sourceUrl ?? "";
      }

      const video = await ctx.prisma.video.create({
        data: {
          orgId,
          productId: input.productId,
          brandKitId: input.brandKitId,
          presetId: input.presetId,
          type: input.videoType,
          status: "SCRAPING",
          avatarId: input.avatarId,
          voiceId: input.voiceId,
          creditsUsed: credits,
        },
      });

      // Deduct credits
      await ctx.prisma.$transaction([
        ctx.prisma.organization.update({
          where: { id: orgId },
          data: { creditsBalance: { decrement: credits } },
        }),
        ctx.prisma.creditTransaction.create({
          data: {
            orgId,
            amount: -credits,
            type: "USAGE",
            referenceId: video.id,
          },
        }),
      ]);

      // Fetch brand kit data for script generator
      let brandKit: {
        toneOfVoice: string;
        targetAudience: string | null;
        colors: Record<string, string>;
      } | null = null;
      if (input.brandKitId) {
        const bk = await ctx.prisma.brandKit.findUnique({
          where: { id: input.brandKitId },
        });
        if (bk) {
          brandKit = {
            toneOfVoice: bk.toneOfVoice,
            targetAudience: bk.targetAudience,
            colors: bk.colors as Record<string, string>,
          };
        }
      }

      // Enqueue to video pipeline (scraper → script → TTS → scenes → assembler)
      await sendJob("scraper", {
        productUrl,
        productId: input.productId ?? "",
        orgId,
        _pipeline: {
          videoId: video.id,
          productUrl,
          productId: input.productId ?? "",
          orgId,
          videoType: input.videoType,
          voiceId: input.voiceId ?? "",
          brandKitId: input.brandKitId,
          presetId: input.presetId,
          brandKit,
          templateStructure: null,
        },
      });

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
