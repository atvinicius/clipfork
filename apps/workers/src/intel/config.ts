// Central env-driven config for the intelligence layer. Everything degrades
// gracefully: collectors need APIFY_API_TOKEN, downloads need R2 creds, music
// ID needs AUDD_API_KEY — each feature is skipped (not fatal) when unconfigured.

export const intelConfig = {
  apifyToken: process.env.APIFY_API_TOKEN ?? "",
  auddApiKey: process.env.AUDD_API_KEY ?? "",

  /** Optional proxy for yt-dlp media downloads (residential recommended). */
  downloadProxyUrl: process.env.INTEL_PROXY_URL ?? "",

  /** Optional cookies for yt-dlp (base64-encoded Netscape cookie files). */
  tiktokCookiesB64: process.env.TIKTOK_COOKIES_B64 ?? "",
  igCookiesB64: process.env.IG_COOKIES_B64 ?? "",

  /** Max due targets the dispatcher enqueues per tick. */
  maxTargetsPerTick: Number(process.env.INTEL_MAX_TARGETS_PER_TICK ?? 50),

  /** Hard cap on downloads enqueued per crawl run. */
  maxDownloadsPerCrawl: Number(process.env.INTEL_MAX_DOWNLOADS_PER_CRAWL ?? 10),

  /** Items to request per collection run. */
  resultsPerPage: Number(process.env.INTEL_RESULTS_PER_PAGE ?? 100),

  /** Signal engine thresholds. */
  risingSoundMinPosts48h: Number(process.env.INTEL_RISING_SOUND_MIN_POSTS ?? 4),
  risingSoundMinGrowth: Number(process.env.INTEL_RISING_SOUND_MIN_GROWTH ?? 0.5),
  breakoutMinFollowerGrowthPct: Number(
    process.env.INTEL_BREAKOUT_MIN_GROWTH_PCT ?? 5
  ),
  breakoutMinNewFollowers: Number(
    process.env.INTEL_BREAKOUT_MIN_NEW_FOLLOWERS ?? 5000
  ),
  hashtagTrendMinPosts: Number(process.env.INTEL_HASHTAG_TREND_MIN_POSTS ?? 5),
} as const;

export function auddEnabled(): boolean {
  return intelConfig.auddApiKey.length > 0;
}
