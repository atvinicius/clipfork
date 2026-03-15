import { router, protectedProcedure } from "../init";

export const presetRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.preset.findMany({
      orderBy: [{ isDefault: "desc" }, { niche: "asc" }],
    });
  }),
});
