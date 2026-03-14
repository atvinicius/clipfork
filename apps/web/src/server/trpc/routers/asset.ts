import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export const assetRouter = router({
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const key = `${ctx.org.id}/${Date.now()}-${input.filename}`;

      try {
        const command = new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: key,
          ContentType: input.mimeType,
          ContentLength: input.sizeBytes,
        });

        const uploadUrl = await getSignedUrl(getR2Client(), command, {
          expiresIn: 3600,
        });

        const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

        return { uploadUrl, key, publicUrl };
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate upload URL",
        });
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        type: z.enum(["IMAGE", "VIDEO", "AUDIO", "MUSIC"]),
        url: z.string().url(),
        filename: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().positive(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.asset.create({
        data: {
          orgId: ctx.org.id,
          type: input.type,
          url: input.url,
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          metadata: input.metadata ?? {},
        },
      });
    }),

  list: protectedProcedure
    .input(
      z.object({
        type: z.enum(["IMAGE", "VIDEO", "AUDIO", "MUSIC"]).optional(),
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const assets = await ctx.prisma.asset.findMany({
        where: {
          orgId: ctx.org.id,
          ...(input.type ? { type: input.type } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (assets.length > input.limit) {
        const next = assets.pop();
        nextCursor = next?.id;
      }

      return { assets, nextCursor };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.asset.delete({
        where: { id: input.id, orgId: ctx.org.id },
      });
    }),
});
