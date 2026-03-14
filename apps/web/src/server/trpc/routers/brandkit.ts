import { z } from "zod";
import { router, protectedProcedure } from "../init";

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
});
