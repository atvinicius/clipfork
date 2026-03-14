import { prisma } from "@ugc/db";
import { decrypt, encrypt } from "@ugc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PublishJobData {
  videoId: string;
  tiktokAccountId: string;
  caption?: string;
  hashtags?: string[];
}

interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  open_id: string;
  token_type: string;
}

interface TikTokPublishInitResponse {
  data: {
    publish_id: string;
    upload_url: string;
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
}

interface TikTokPublishStatusResponse {
  data: {
    status: string;
    publicaly_available_post_id?: string[];
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

async function refreshTikTokToken(
  refreshToken: string
): Promise<TikTokTokenResponse> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    throw new Error("TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be set");
  }

  const response = await fetch(
    "https://open.tiktokapis.com/v2/oauth/token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TikTok token refresh failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<TikTokTokenResponse>;
}

// ---------------------------------------------------------------------------
// TikTok Content Posting API v2
// ---------------------------------------------------------------------------

async function initVideoPublish(
  accessToken: string,
  videoUrl: string,
  caption: string,
  hashtags: string[]
): Promise<TikTokPublishInitResponse> {
  const fullCaption = hashtags.length > 0
    ? `${caption} ${hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
    : caption;

  const response = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: fullCaption.substring(0, 150),
          privacy_level: "SELF_ONLY",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
          is_aigc: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `TikTok publish init failed: ${response.status} ${text}`
    );
  }

  return response.json() as Promise<TikTokPublishInitResponse>;
}

async function checkPublishStatus(
  accessToken: string,
  publishId: string
): Promise<TikTokPublishStatusResponse> {
  const response = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        publish_id: publishId,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `TikTok publish status check failed: ${response.status} ${text}`
    );
  }

  return response.json() as Promise<TikTokPublishStatusResponse>;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processPublishJob(job: { data: PublishJobData }) {
  const { videoId, tiktokAccountId, caption, hashtags } = job.data;

  console.log(
    `[publisher] Publishing video ${videoId} to TikTok account ${tiktokAccountId}`
  );

  try {
    // 1. Get video from DB
    const video = await prisma.video.findUniqueOrThrow({
      where: { id: videoId },
    });

    if (!video.finalVideoUrl) {
      throw new Error(`Video ${videoId} has no final video URL`);
    }

    // 2. Get TikTok account from DB
    const account = await prisma.tikTokAccount.findUniqueOrThrow({
      where: { id: tiktokAccountId },
    });

    if (!account.isActive) {
      throw new Error(`TikTok account ${tiktokAccountId} is not active`);
    }

    // 3. Decrypt access token and check expiry
    let accessToken = decrypt(account.accessToken);
    const refreshToken = decrypt(account.refreshToken);

    if (new Date() >= account.tokenExpiresAt) {
      console.log(`[publisher] Token expired, refreshing...`);

      const tokenResponse = await refreshTikTokToken(refreshToken);

      accessToken = tokenResponse.access_token;
      const newExpiresAt = new Date(
        Date.now() + tokenResponse.expires_in * 1000
      );

      await prisma.tikTokAccount.update({
        where: { id: tiktokAccountId },
        data: {
          accessToken: encrypt(tokenResponse.access_token),
          refreshToken: encrypt(tokenResponse.refresh_token),
          tokenExpiresAt: newExpiresAt,
        },
      });

      console.log(`[publisher] Token refreshed successfully`);
    }

    // 4. Initialize publish via TikTok API
    const publishCaption = caption ?? video.script?.substring(0, 150) ?? "";
    const publishHashtags = hashtags ?? [];

    const initResponse = await initVideoPublish(
      accessToken,
      video.finalVideoUrl,
      publishCaption,
      publishHashtags
    );

    if (initResponse.error?.code && initResponse.error.code !== "ok") {
      throw new Error(
        `TikTok publish init error: ${initResponse.error.code} - ${initResponse.error.message}`
      );
    }

    const publishId = initResponse.data.publish_id;
    console.log(`[publisher] Publish initiated, ID: ${publishId}`);

    // 5. Poll for publish completion (max 5 minutes)
    const maxAttempts = 30;
    const pollIntervalMs = 10000;
    let publishedUrl: string | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      const statusResponse = await checkPublishStatus(accessToken, publishId);

      if (statusResponse.data.status === "PUBLISH_COMPLETE") {
        const postIds =
          statusResponse.data.publicaly_available_post_id ?? [];
        if (postIds.length > 0) {
          publishedUrl = `https://www.tiktok.com/@${account.handle}/video/${postIds[0]}`;
        }
        console.log(`[publisher] Video published successfully: ${publishedUrl}`);
        break;
      }

      if (
        statusResponse.data.status === "FAILED" ||
        statusResponse.error?.code !== "ok"
      ) {
        throw new Error(
          `TikTok publish failed: ${statusResponse.error?.message ?? statusResponse.data.status}`
        );
      }

      console.log(
        `[publisher] Publish status: ${statusResponse.data.status} (attempt ${attempt + 1}/${maxAttempts})`
      );
    }

    // 6. Update video record
    await prisma.video.update({
      where: { id: videoId },
      data: {
        publishedAt: new Date(),
        publishedUrl: publishedUrl ?? `tiktok://publish/${publishId}`,
      },
    });

    console.log(`[publisher] Video ${videoId} published successfully`);

    return { videoId, publishId, publishedUrl };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(`[publisher] Failed to publish video ${videoId}:`, errorMessage);

    // Store error on video but don't charge extra credits
    await prisma.video.update({
      where: { id: videoId },
      data: {
        error: `Publishing failed: ${errorMessage}`,
      },
    });

    throw error;
  }
}
