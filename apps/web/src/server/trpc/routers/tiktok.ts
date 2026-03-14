import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import { encrypt } from "@ugc/shared";
import { sendJob } from "../../queue";

export const tiktokRouter = router({
  getAuthUrl: protectedProcedure.query(() => {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "TikTok client key not configured",
      });
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/tiktok/callback`;
    const scope = "user.info.basic,video.publish,video.upload";
    const state = Math.random().toString(36).substring(2, 15);

    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", clientKey);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scope);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);

    return { url: url.toString(), state };
  }),

  handleCallback: protectedProcedure
    .input(
      z.object({
        code: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const clientKey = process.env.TIKTOK_CLIENT_KEY;
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

      if (!clientKey || !clientSecret) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "TikTok OAuth not configured",
        });
      }

      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/tiktok/callback`;

      const tokenResponse = await fetch(
        "https://open.tiktokapis.com/v2/oauth/token/",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_key: clientKey,
            client_secret: clientSecret,
            code: input.code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
          }),
        }
      );

      if (!tokenResponse.ok) {
        const text = await tokenResponse.text();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `TikTok token exchange failed: ${text}`,
        });
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        open_id: string;
      };

      const userResponse = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username",
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        }
      );

      let handle = tokenData.open_id;
      if (userResponse.ok) {
        const userData = (await userResponse.json()) as {
          data: { user: { username?: string; display_name?: string } };
        };
        handle =
          userData.data.user.username ??
          userData.data.user.display_name ??
          tokenData.open_id;
      }

      const expiresAt = new Date(
        Date.now() + tokenData.expires_in * 1000
      );

      const account = await ctx.prisma.tikTokAccount.upsert({
        where: {
          orgId_tikTokUserId: {
            orgId: ctx.org.id,
            tikTokUserId: tokenData.open_id,
          },
        },
        create: {
          orgId: ctx.org.id,
          tikTokUserId: tokenData.open_id,
          handle,
          accessToken: encrypt(tokenData.access_token),
          refreshToken: encrypt(tokenData.refresh_token),
          tokenExpiresAt: expiresAt,
          isActive: true,
        },
        update: {
          handle,
          accessToken: encrypt(tokenData.access_token),
          refreshToken: encrypt(tokenData.refresh_token),
          tokenExpiresAt: expiresAt,
          isActive: true,
        },
      });

      return account;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.tikTokAccount.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        handle: true,
        tikTokUserId: true,
        isActive: true,
        tokenExpiresAt: true,
        createdAt: true,
      },
    });
  }),

  disconnect: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.tikTokAccount.update({
        where: {
          id: input.id,
          orgId: ctx.org.id,
        },
        data: { isActive: false },
      });
    }),

  publish: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
        tiktokAccountId: z.string(),
        caption: z.string().max(150).optional(),
        hashtags: z.array(z.string()).max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const video = await ctx.prisma.video.findFirst({
        where: {
          id: input.videoId,
          orgId: ctx.org.id,
          status: "COMPLETED",
        },
      });

      if (!video) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Completed video not found",
        });
      }

      const account = await ctx.prisma.tikTokAccount.findFirst({
        where: {
          id: input.tiktokAccountId,
          orgId: ctx.org.id,
          isActive: true,
        },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Active TikTok account not found",
        });
      }

      await ctx.prisma.video.update({
        where: { id: input.videoId },
        data: { tiktokAccountId: input.tiktokAccountId },
      });

      await sendJob("publish", {
        videoId: input.videoId,
        tiktokAccountId: input.tiktokAccountId,
        caption: input.caption,
        hashtags: input.hashtags,
      });

      return { queued: true };
    }),

  schedule: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
        tiktokAccountId: z.string(),
        scheduledPublishAt: z.string().datetime(),
        caption: z.string().max(150).optional(),
        hashtags: z.array(z.string()).max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const video = await ctx.prisma.video.findFirst({
        where: {
          id: input.videoId,
          orgId: ctx.org.id,
          status: "COMPLETED",
        },
      });

      if (!video) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Completed video not found",
        });
      }

      const account = await ctx.prisma.tikTokAccount.findFirst({
        where: {
          id: input.tiktokAccountId,
          orgId: ctx.org.id,
          isActive: true,
        },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Active TikTok account not found",
        });
      }

      return ctx.prisma.video.update({
        where: { id: input.videoId },
        data: {
          scheduledPublishAt: new Date(input.scheduledPublishAt),
          tiktokAccountId: input.tiktokAccountId,
        },
      });
    }),
});
