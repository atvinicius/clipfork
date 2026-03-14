import { z } from "zod";
import { router, protectedProcedure } from "../init";

export const creditsRouter = router({
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    return {
      balance: ctx.org.creditsBalance,
      monthly: ctx.org.creditsMonthly,
      plan: ctx.org.plan,
    };
  }),

  getTransactions: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const transactions = await ctx.prisma.creditTransaction.findMany({
        where: { orgId: ctx.org.id },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (transactions.length > input.limit) {
        const next = transactions.pop();
        nextCursor = next?.id;
      }

      return { transactions, nextCursor };
    }),
});
