import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { canAfford } from "@ugc/shared";
import { sendJob } from "../../queue";

export const brandKitRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        logoUrl: z.string().url().optional(),
        colors: z
          .object({
            primary: z.string().optional(),
            secondary: z.string().optional(),
            accent: z.string().optional(),
            background: z.string().optional(),
          })
          .optional(),
        toneOfVoice: z
          .enum(["CASUAL", "PROFESSIONAL", "HYPE", "EDUCATIONAL", "TESTIMONIAL"])
          .default("CASUAL"),
        targetAudience: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.brandKit.create({
        data: {
          orgId: ctx.org.id,
          name: input.name,
          logoUrl: input.logoUrl,
          colors: input.colors ?? {},
          toneOfVoice: input.toneOfVoice,
          targetAudience: input.targetAudience,
        },
      });
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.brandKit.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.brandKit.findFirstOrThrow({
        where: { id: input.id, orgId: ctx.org.id },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        logoUrl: z.string().url().nullable().optional(),
        colors: z
          .object({
            primary: z.string().optional(),
            secondary: z.string().optional(),
            accent: z.string().optional(),
            background: z.string().optional(),
          })
          .optional(),
        toneOfVoice: z
          .enum(["CASUAL", "PROFESSIONAL", "HYPE", "EDUCATIONAL", "TESTIMONIAL"])
          .optional(),
        targetAudience: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.brandKit.update({
        where: { id, orgId: ctx.org.id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.brandKit.delete({
        where: { id: input.id, orgId: ctx.org.id },
      });
    }),

  trainLoRA: protectedProcedure
    .input(
      z.object({
        brandKitId: z.string(),
        imageUrls: z.array(z.string().url()).min(4, "At least 4 images required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!canAfford(ctx.org.creditsBalance, 1)) {
        throw new Error("Insufficient credits. LoRA training requires 1 credit.");
      }

      await ctx.prisma.brandKit.update({
        where: { id: input.brandKitId, orgId: ctx.org.id },
        data: {
          loraTrainingImages: input.imageUrls,
          loraTrainingStatus: "pending",
        },
      });

      await ctx.prisma.$transaction([
        ctx.prisma.organization.update({
          where: { id: ctx.org.id },
          data: { creditsBalance: { decrement: 1 } },
        }),
        ctx.prisma.creditTransaction.create({
          data: {
            orgId: ctx.org.id,
            amount: -1,
            type: "USAGE",
            referenceId: input.brandKitId,
          },
        }),
      ]);

      await sendJob("lora-training", {
        brandKitId: input.brandKitId,
        orgId: ctx.org.id,
      });

      return { status: "pending" };
    }),

  getTrainingStatus: protectedProcedure
    .input(z.object({ brandKitId: z.string() }))
    .query(async ({ ctx, input }) => {
      const brandKit = await ctx.prisma.brandKit.findFirstOrThrow({
        where: { id: input.brandKitId, orgId: ctx.org.id },
        select: {
          loraTrainingStatus: true,
          loraUrl: true,
          loraTriggerWord: true,
        },
      });
      return brandKit;
    }),
});
