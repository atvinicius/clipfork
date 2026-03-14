import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";

export const templateRouter = router({
  // ---------------------------------------------------------------------------
  // listPublic — browse platform templates with filters
  // ---------------------------------------------------------------------------
  listPublic: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(),
        industry: z.string().optional(),
        pacing: z.enum(["slow", "medium", "fast"]).optional(),
        minScenes: z.number().min(1).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build where clause
      const where: Record<string, unknown> = {
        isPublic: true,
      };

      if (input.category) {
        where.category = input.category;
      }

      if (input.industry) {
        where.industry = { has: input.industry };
      }

      const templates = await ctx.prisma.template.findMany({
        where,
        orderBy: { engagementScore: { sort: "desc", nulls: "last" } },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      // Post-filter by pacing and minScenes (stored in JSON structure)
      let filtered = templates;

      if (input.pacing) {
        filtered = filtered.filter((t) => {
          const structure = t.structure as {
            style?: { pacing?: string };
          };
          return structure.style?.pacing === input.pacing;
        });
      }

      if (input.minScenes) {
        filtered = filtered.filter((t) => {
          const structure = t.structure as {
            structure?: { scenes?: unknown[] };
          };
          return (
            (structure.structure?.scenes?.length ?? 0) >=
            (input.minScenes ?? 0)
          );
        });
      }

      if (input.search) {
        const query = input.search.toLowerCase();
        filtered = filtered.filter((t) => {
          const cat = (t.category ?? "").toLowerCase();
          const industries = t.industry.map((i) => i.toLowerCase());
          return (
            cat.includes(query) || industries.some((i) => i.includes(query))
          );
        });
      }

      let nextCursor: string | undefined;
      if (filtered.length > input.limit) {
        const next = filtered.pop();
        nextCursor = next?.id;
      }

      return { templates: filtered, nextCursor };
    }),

  // ---------------------------------------------------------------------------
  // listMine — user's saved templates
  // ---------------------------------------------------------------------------
  listMine: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const templates = await ctx.prisma.template.findMany({
        where: { orgId: ctx.org.id },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (templates.length > input.limit) {
        const next = templates.pop();
        nextCursor = next?.id;
      }

      return { templates, nextCursor };
    }),

  // ---------------------------------------------------------------------------
  // getById — single template with full structure
  // ---------------------------------------------------------------------------
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.prisma.template.findFirst({
        where: {
          id: input.id,
          OR: [{ orgId: ctx.org.id }, { isPublic: true }],
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
  // save — save template to user's library
  // ---------------------------------------------------------------------------
  save: protectedProcedure
    .input(
      z.object({
        sourceTemplateId: z.string().optional(),
        sourceUrl: z.string().url().optional(),
        sourcePlatform: z.enum(["TIKTOK", "INSTAGRAM", "YOUTUBE"]).optional(),
        structure: z.record(z.unknown()),
        category: z.string().optional(),
        industry: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // If saving from an existing public template, copy it
      if (input.sourceTemplateId) {
        const source = await ctx.prisma.template.findFirst({
          where: {
            id: input.sourceTemplateId,
            OR: [{ isPublic: true }, { orgId: ctx.org.id }],
          },
        });

        if (!source) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Source template not found",
          });
        }

        return ctx.prisma.template.create({
          data: {
            orgId: ctx.org.id,
            sourceUrl: source.sourceUrl,
            sourcePlatform: source.sourcePlatform,
            structure: source.structure as Record<string, unknown>,
            category: source.category,
            industry: source.industry,
            engagementScore: source.engagementScore,
            isPublic: false,
          },
        });
      }

      // Create new template
      return ctx.prisma.template.create({
        data: {
          orgId: ctx.org.id,
          sourceUrl: input.sourceUrl,
          sourcePlatform: input.sourcePlatform,
          structure: input.structure,
          category: input.category,
          industry: input.industry ?? [],
          isPublic: false,
        },
      });
    }),

  // ---------------------------------------------------------------------------
  // delete — delete user's template
  // ---------------------------------------------------------------------------
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.prisma.template.findFirst({
        where: { id: input.id, orgId: ctx.org.id },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      return ctx.prisma.template.delete({
        where: { id: input.id },
      });
    }),
});
