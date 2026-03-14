import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@ugc/db";
import superjson from "superjson";

export async function createTRPCContext() {
  const { userId, orgId } = await auth();
  return { userId, orgId, prisma };
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  // Look up the user's organization
  const user = await ctx.prisma.user.findUnique({
    where: { clerkUserId: ctx.userId },
    include: { org: true },
  });
  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User not found. Complete onboarding first.",
    });
  }
  return next({
    ctx: { ...ctx, user, org: user.org },
  });
});
