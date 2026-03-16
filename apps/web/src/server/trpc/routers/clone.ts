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

      // Only enqueue download — worker chains to analyze after completion
      const jobId = await sendJob("clone-download", {
        url: input.url,
        orgId,
        sourceUrl: input.url,
      });

      return {
        jobId: jobId ?? "unknown",
        sourceUrl: input.url,
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
  // pollAnalysis — poll for analysis completion by source URL
  // ---------------------------------------------------------------------------
  pollAnalysis: protectedProcedure
    .input(
      z.object({
        sourceUrl: z.string().url(),
      })
    )
    .query(async ({ ctx, input }) => {
      const template = await ctx.prisma.template.findFirst({
        where: {
          orgId: ctx.org.id,
          sourceUrl: input.sourceUrl,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!template) {
        return { status: "processing" as const, template: null };
      }

      return { status: "completed" as const, template };
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
        ctx.prisma.video.update({
          where: { id: video.id },
          data: { status: "SCRAPING" },
        }),
      ]);

      // 5. Resolve product URL and enqueue to pipeline
      const product = await ctx.prisma.product.findUnique({
        where: { id: input.productId },
      });
      const productUrl = input.productUrl ?? product?.sourceUrl ?? "";

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

      await sendJob("scraper", {
        productUrl,
        productId: input.productId,
        orgId,
        _pipeline: {
          videoId: video.id,
          productUrl,
          productId: input.productId,
          orgId,
          videoType: "CLONED" as const,
          voiceId: input.voiceId,
          brandKitId: input.brandKitId,
          presetId: input.presetId,
          templateId: input.templateId,
          brandKit,
          templateStructure: template.structure,
        },
      });

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

      // 5. Deduct credits and update statuses
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
        ...videos.map((video) =>
          ctx.prisma.video.update({
            where: { id: video.id },
            data: { status: "SCRAPING" },
          })
        ),
      ]);

      // 6. Enqueue each variant to the pipeline
      for (const [i, video] of videos.entries()) {
        const variant = input.variants[i]!;
        const product = await ctx.prisma.product.findUnique({
          where: { id: variant.productId },
        });
        const productUrl = variant.productUrl ?? product?.sourceUrl ?? "";

        let brandKit: {
          toneOfVoice: string;
          targetAudience: string | null;
          colors: Record<string, string>;
        } | null = null;
        if (variant.brandKitId) {
          const bk = await ctx.prisma.brandKit.findUnique({
            where: { id: variant.brandKitId },
          });
          if (bk) {
            brandKit = {
              toneOfVoice: bk.toneOfVoice,
              targetAudience: bk.targetAudience,
              colors: bk.colors as Record<string, string>,
            };
          }
        }

        await sendJob("scraper", {
          productUrl,
          productId: variant.productId,
          orgId,
          _pipeline: {
            videoId: video.id,
            productUrl,
            productId: variant.productId,
            orgId,
            videoType: "CLONED" as const,
            voiceId: variant.voiceId,
            brandKitId: variant.brandKitId,
            presetId: variant.presetId,
            templateId: input.templateId,
            brandKit,
            templateStructure: template.structure,
          },
        });
      }

      return {
        batchId,
        videoIds: videos.map((v) => v.id),
        totalCreditsUsed: totalCredits,
      };
    }),
});
