import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import * as cheerio from "cheerio";

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

  scrapeUrl: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      let html: string;
      try {
        const response = await fetch(input.url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        html = await response.text();
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not fetch that URL. Check it's valid and publicly accessible.",
        });
      }

      const $ = cheerio.load(html);

      const title =
        $('meta[property="og:title"]').attr("content") ??
        $("title").text().trim() ??
        "Untitled Product";

      const description =
        $('meta[property="og:description"]').attr("content") ??
        $('meta[name="description"]').attr("content") ??
        "";

      const images: string[] = [];
      const ogImage = $('meta[property="og:image"]').attr("content");
      if (ogImage) {
        try { images.push(new URL(ogImage, input.url).href); } catch {}
      }
      $("img").slice(0, 10).each((_i, el) => {
        const src = $(el).attr("src");
        if (src && !src.includes("data:image") && !src.includes("svg")) {
          try {
            const abs = new URL(src, input.url).href;
            if (!images.includes(abs)) images.push(abs);
          } catch {}
        }
      });

      let price: string | null = null;
      for (const sel of ['[class*="price"]', '[data-price]', '[itemprop="price"]', ".price"]) {
        const el = $(sel).first();
        if (el.length) {
          const match = el.text().trim().match(/[\$\u00a3\u20ac]?\s?\d+[.,]\d{2}/);
          if (match) { price = match[0]; break; }
        }
      }

      const product = await ctx.prisma.product.create({
        data: {
          orgId: ctx.org.id,
          name: title.substring(0, 200),
          sourceUrl: input.url,
          description: description.substring(0, 2000),
          price,
          images: images.slice(0, 10),
          scrapedData: {
            title,
            description,
            images: images.slice(0, 10),
            price,
            scrapedAt: new Date().toISOString(),
            source: input.url,
          },
        },
      });

      return product;
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
