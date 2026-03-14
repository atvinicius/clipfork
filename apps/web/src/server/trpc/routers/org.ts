import { z } from "zod";
import { router, protectedProcedure } from "../init";

export const orgRouter = router({
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    return ctx.org;
  }),

  getMembers: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "asc" },
    });
  }),
});
