import { z } from "zod";
import { router, protectedProcedure } from "../init";

export const productRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        sourceUrl: z.string().url().optional(),
        description: z.string().optional(),
        price: z.string().optional(),
        brandKitId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.product.create({
        data: {
          orgId: ctx.org.id,
          name: input.name,
          sourceUrl: input.sourceUrl,
          description: input.description,
          price: input.price,
          brandKitId: input.brandKitId,
        },
      });
    }),

  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const products = await ctx.prisma.product.findMany({
        where: { orgId: ctx.org.id },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { brandKit: true },
      });

      let nextCursor: string | undefined;
      if (products.length > input.limit) {
        const next = products.pop();
        nextCursor = next?.id;
      }

      return { products, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.product.findFirstOrThrow({
        where: { id: input.id, orgId: ctx.org.id },
        include: { brandKit: true },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        price: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.product.update({
        where: { id, orgId: ctx.org.id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.product.delete({
        where: { id: input.id, orgId: ctx.org.id },
      });
    }),
});
