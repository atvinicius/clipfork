import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import {
  calculateClonedVideoCredits,
  canAfford,
  type SceneType,
} from "@ugc/shared";
import { sendJob } from "../../queue";

export const cloneRouter = router({
  // ---------------------------------------------------------------------------
  // analyzeUrl — enqueue download + analysis, return job ID
  // ---------------------------------------------------------------------------
  analyzeUrl: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.org.id;

      // Enqueue download job
      const jobId = await sendJob("clone-download", {
        url: input.url,
        orgId,
      });

      // Enqueue analysis job
      await sendJob("clone-analyze", {
        videoUrl: "",
        videoKey: "",
        sourceUrl: input.url,
        orgId,
        downloadJobId: jobId,
      });

      return {
        jobId: jobId ?? "unknown",
        status: "queued",
      };
    }),

  // ---------------------------------------------------------------------------
  // getAnalysis — get analysis result by template ID
  // ---------------------------------------------------------------------------
  getAnalysis: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const template = await ctx.prisma.template.findFirst({
        where: {
          id: input.templateId,
          orgId: ctx.org.id,
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      return template;
    }),

  // ---------------------------------------------------------------------------
  // generateFromTemplate — create video using template + selections
  // ---------------------------------------------------------------------------
  generateFromTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        productId: z.string(),
        productUrl: z.string().url().optional(),
        voiceId: z.string(),
        avatarId: z.string().optional(),
        brandKitId: z.string().optional(),
        presetId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.org.id;

      // 1. Get template for credit calculation
      const template = await ctx.prisma.template.findFirstOrThrow({
        where: { id: input.templateId },
      });

      const structure = template.structure as {
        structure?: {
          scenes?: Array<{ type: string }>;
        };
      };
      const scenes = structure.structure?.scenes ?? [];
      const creditCost = calculateClonedVideoCredits(
        scenes.map((s) => ({
          type: s.type as SceneType,
        }))
      );

      // 2. Check credits
      if (!canAfford(ctx.org.creditsBalance, creditCost)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Insufficient credits: need ${creditCost}, have ${ctx.org.creditsBalance}`,
        });
      }

      // 3. Create video record
      const video = await ctx.prisma.video.create({
        data: {
          orgId,
          productId: input.productId,
          templateId: input.templateId,
          brandKitId: input.brandKitId,
          presetId: input.presetId,
          type: "CLONED",
          status: "QUEUED",
          avatarId: input.avatarId,
          voiceId: input.voiceId,
          creditsUsed: creditCost,
        },
      });

      // 4. Deduct credits
      await ctx.prisma.$transaction([
        ctx.prisma.organization.update({
          where: { id: orgId },
          data: { creditsBalance: { decrement: creditCost } },
        }),
        ctx.prisma.creditTransaction.create({
          data: {
            orgId,
            amount: -creditCost,
            type: "USAGE",
            referenceId: video.id,
          },
        }),
      ]);

      // 5. TODO: enqueue to clone generation pipeline

      return {
        videoId: video.id,
        creditsUsed: creditCost,
      };
    }),

  // ---------------------------------------------------------------------------
  // generateVariants — batch generate multiple variants from one template
  // ---------------------------------------------------------------------------
  generateVariants: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        variants: z
          .array(
            z.object({
              productId: z.string(),
              productUrl: z.string().url().optional(),
              voiceId: z.string(),
              avatarId: z.string().optional(),
              brandKitId: z.string().optional(),
              presetId: z.string().optional(),
            })
          )
          .min(1)
          .max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.org.id;

      // 1. Get template for credit calculation
      const template = await ctx.prisma.template.findFirstOrThrow({
        where: { id: input.templateId },
      });

      const structure = template.structure as {
        structure?: {
          scenes?: Array<{ type: string }>;
        };
      };
      const scenes = structure.structure?.scenes ?? [];
      const creditPerVariant = calculateClonedVideoCredits(
        scenes.map((s) => ({
          type: s.type as SceneType,
        }))
      );

      const totalCredits = creditPerVariant * input.variants.length;

      // 2. Check credits
      if (!canAfford(ctx.org.creditsBalance, totalCredits)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Insufficient credits: need ${totalCredits} for ${input.variants.length} variants, have ${ctx.org.creditsBalance}`,
        });
      }

      // 3. Generate a batch ID
      const batchId = crypto.randomUUID();

      // 4. Create video records
      const videos = await Promise.all(
        input.variants.map((variant) =>
          ctx.prisma.video.create({
            data: {
              orgId,
              productId: variant.productId,
              templateId: input.templateId,
              brandKitId: variant.brandKitId,
              batchId,
              type: "CLONED",
              status: "QUEUED",
              avatarId: variant.avatarId,
              voiceId: variant.voiceId,
              creditsUsed: creditPerVariant,
            },
          })
        )
      );

      // 5. Deduct credits
      await ctx.prisma.$transaction([
        ctx.prisma.organization.update({
          where: { id: orgId },
          data: { creditsBalance: { decrement: totalCredits } },
        }),
        ...videos.map((video) =>
          ctx.prisma.creditTransaction.create({
            data: {
              orgId,
              amount: -creditPerVariant,
              type: "USAGE",
              referenceId: video.id,
            },
          })
        ),
      ]);

      // 6. TODO: enqueue each to clone generation pipeline

      return {
        batchId,
        videoIds: videos.map((v) => v.id),
        totalCreditsUsed: totalCredits,
      };
    }),
});
