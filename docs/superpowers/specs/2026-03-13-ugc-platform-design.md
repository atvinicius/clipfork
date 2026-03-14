# UGC Automation Platform — Design Spec

## Overview

A multi-tenant SaaS platform for generating UGC-style video ads at scale, differentiated by a **viral structure cloning engine** that deconstructs proven viral content and lets users rebuild it with their own brand assets. Targets DTC/e-commerce brands and marketing agencies.

**Core value proposition:** Clone any viral video's structure, fill it with your product, and generate dozens of variants for A/B testing — all self-serve, no sales call required.

**Competitive landscape (March 2026):**
- Synthesia: $4B valuation, ~$200M ARR — enterprise/training focus
- HeyGen: $100M ARR — avatar quality leader
- Arcads: $10M ARR with 10 people — UGC ads
- Creatify: $9M ARR — URL-to-video pioneer
- Bluma (YC F25): $28K MRR in 4 weeks — viral cloning, but sales-gated

This platform democratizes viral structure cloning as self-serve SaaS.

---

## 1. System Architecture

### Stack

- **Monorepo:** Turborepo
  - `apps/web` — Next.js 15 (App Router) deployed on Vercel
  - `apps/workers` — BullMQ job processors deployed on Railway
  - `packages/db` — Prisma schema + migrations
  - `packages/shared` — TypeScript types, Zod schemas, utilities
- **API:** tRPC (end-to-end type safety, no codegen)
- **Database:** PostgreSQL via Supabase
- **Queue:** Redis (Upstash) + BullMQ
- **Storage:** Cloudflare R2 (S3-compatible, zero egress fees)
- **Auth:** Clerk (organizations, roles, OAuth)
- **Billing:** Stripe (subscriptions, webhooks)
- **CI/CD:** GitHub Actions
- **Local dev:** Docker Compose (PostgreSQL + Redis), Turborepo dev orchestration

### Request Flow

```
Browser → Next.js (Vercel)
  → tRPC API routes
    → PostgreSQL (read/write)
    → Redis/BullMQ (enqueue jobs)
      → Workers (Railway)
        → Third-party APIs (scraping, LLM, TTS, avatar)
        → R2 (store artifacts)
        → PostgreSQL (update status)
      → tRPC subscriptions (SSE) → Browser (real-time progress)
```

### Worker Architecture

Workers are Node.js processes consuming from BullMQ queues. Each worker type handles one pipeline stage:

| Worker | Responsibility | External Service |
|--------|---------------|-----------------|
| Scraper | Product page data extraction | Firecrawl (primary), Puppeteer (fallback) |
| Clone Analyzer | Viral video deconstruction | Gemini 2.5 Flash (native video analysis) |
| Script Generator | Scene-by-scene script creation | Claude Sonnet 4.6 |
| TTS | Text-to-speech conversion | ElevenLabs |
| Avatar | Talking head video generation | D-ID (primary) |
| Composer | Final video assembly | Remotion + FFmpeg |
| Publisher | Auto-post to platforms | TikTok Content Posting API |
| Monitor | Competitor scanning (cron) | Apify (TikTok/Instagram scraper actors) |

---

## 2. Viral Structure Cloning Engine

The core differentiator. Three interconnected systems.

### 2.1 Clone Pipeline

**Input:** TikTok/Instagram Reel URL or uploaded video file.

**Step 1 — Extract:** Download video via yt-dlp (primary), with RapidAPI TikTok downloader as fallback if yt-dlp fails. If both fail, user can upload the video file directly. Scrape engagement metrics via Apify scraper actors.

**Step 2 — Analyze:** Send full video to Gemini 2.5 Flash (native video processing — understands pacing, transitions, temporal flow, and audio/speech without separate transcription). No separate Whisper transcription step needed since Gemini processes audio natively. Output is a structured JSON template:

```json
{
  "structure": {
    "hook": { "type": "question", "duration_s": 2.5, "text_overlay": true },
    "scenes": [
      { "type": "talking_head", "duration_s": 4, "emotion": "excited", "gesture": "pointing" },
      { "type": "product_broll", "duration_s": 3, "transition": "zoom_cut" },
      { "type": "testimonial", "duration_s": 3.5, "text_overlay": "social_proof" }
    ],
    "cta": { "type": "urgency", "duration_s": 2, "text_overlay": true }
  },
  "style": {
    "pacing": "fast",
    "music_mood": "upbeat_electronic",
    "caption_style": "word_by_word_highlight",
    "color_tone": "warm"
  },
  "format": { "aspect": "9:16", "total_duration_s": 15 }
}
```

**Step 3 — Customize:** Interactive scene-by-scene editor. User swaps in their product (from URL scrape or asset library), avatar, brand kit, and reviews AI-generated script fitted to the template structure.

**Step 4 — Generate:** Batch generation of 5-50 variants (different hooks, scripts, avatars, CTAs) — each variant enters the standard video pipeline.

### 2.2 Competitor Monitoring

Users create watch lists targeting competitor TikTok accounts, hashtags, or keywords. Configuration includes platform and scan frequency (daily, twice daily, weekly).

A cron-driven Monitor Worker uses **Apify scraper actors** (pre-built TikTok and Instagram scrapers) to collect public post data and engagement metrics. Apify provides structured data via API — no custom scraping or headless browsers needed. The worker flags outlier content (3x+ average engagement), auto-deconstructs top performers into templates via the Clone Analyzer. Users receive email (Resend) and in-app notifications with one-click "Clone This" actions. Weekly trend digest summarizes top-performing content across all watch lists.

### 2.3 Template Marketplace

Two sources of templates:

- **Platform-curated:** Pre-deconstructed viral structures updated daily from trending content. Categorized by hook type, industry, and format. Engagement scores displayed.
- **User-created:** Users save their own deconstructed templates for reuse. Personal library with optional sharing (community marketplace is a future feature).

---

## 3. Video Generation Pipeline

Video generation is modeled as a BullMQ Flow (DAG). Steps run in parallel where dependencies allow.

```
Scrape → Script → [TTS ‖ B-roll prep] → Avatar → Compose → Deliver
```

### Pipeline Steps

1. **Scrape** (~3-5s) — Firecrawl extracts product title, description, images, price, reviews from URL. Fallback to Puppeteer.
2. **Script** (~5-10s) — Claude Sonnet 4.6 generates scene-by-scene script. If cloning, script is fitted to the template structure. If freeform, uses hook/benefit/CTA format. Multiple variant scripts generated for batch mode.
3. **TTS** (~5-15s, parallel with 3b) — ElevenLabs converts script to audio. Per-scene audio segments.
4. **B-roll prep** (~2-5s, parallel with 3a) — Resize product images, generate text overlays, fetch stock b-roll if needed.
5. **Avatar** (~30-120s) — D-ID API (primary — mature REST API, good developer experience, competitive pricing). Creatify Aurora is evaluated as a future upgrade path for higher realism. Skipped for faceless videos.
6. **Compose** (~20-60s) — Remotion renders final video: avatar clips + b-roll + text overlays + captions + transitions + music + logo. Output: 1080x1920 MP4 (9:16).
7. **Deliver** — Upload to R2, optionally publish to TikTok via Content Posting API, provide download link.

### Content Type Routing

| Type | Pipeline | Cost |
|------|----------|------|
| Talking Head | Full pipeline (includes avatar API) | ~1-3 credits |
| Faceless | Skip avatar step (images + text + voiceover) | ~0.5-1 credit |
| Cloned Structure | Template-driven, routes per scene type | Sum of scene costs: talking_head scenes = 1 credit each, faceless scenes (product_broll, text_overlay, testimonial) = 0.25 credits each. Example: 1 talking_head + 3 faceless scenes = 1.75 credits |

### Batch Variant Generation

Fan-out after script step. Each variant is an independent BullMQ flow running concurrently, limited by worker concurrency and API rate limits. A parent job tracks overall batch progress. Up to 50 variants per batch.

### Estimated Times

- Faceless video: ~30-45 seconds
- Talking head: ~1-3 minutes
- Batch of 10 variants: ~3-5 minutes (concurrent)

---

## 4. Data Model

### Core Entities (PostgreSQL via Prisma)

**Organization** — Multi-tenant root entity. Fields: id (uuid), clerkOrgId, name, plan (FREE/STARTER/GROWTH/SCALE), creditsBalance, creditsMonthly, stripeCustomerId, stripeSubscriptionId.

**User** — Belongs to Organization. Fields: id, clerkUserId, orgId (FK), role (OWNER/ADMIN/MEMBER), email.

**CreditTransaction** — Append-only ledger for all credit changes. Fields: id, orgId (FK), amount (+/-), type (PURCHASE/USAGE/REFUND/MONTHLY_RESET), referenceId (FK → Video, nullable). Monthly reset zeroes unused credits and adds the plan's monthly allocation (credits do not roll over).

**BrandKit** — Brand identity. Fields: id, orgId (FK), name, logoUrl, colors (json), toneOfVoice (enum), targetAudience.

**Product** — Scraped product data. Fields: id, orgId (FK), brandKitId (FK, nullable), name, description, price, sourceUrl, images (json), reviews (json), scrapedData (json).

**Asset** — Uploaded media. Fields: id, orgId (FK), type (IMAGE/VIDEO/AUDIO/MUSIC), url, filename, mimeType, sizeBytes, metadata (json).

**Template** — Deconstructed viral structure. Fields: id, orgId (FK, nullable — null = platform template), sourceUrl, sourcePlatform (TIKTOK/INSTAGRAM/YOUTUBE), structure (json — validated with Zod), category, industry (string[]), engagementScore, isPublic, thumbnailUrl.

**CompetitorWatch** — Monitoring configuration. Fields: id, orgId (FK), type (ACCOUNT/HASHTAG/KEYWORD), platform, value, scanFrequency (DAILY/TWICE_DAILY/WEEKLY), lastScannedAt, isActive.

**CompetitorPost** — Discovered content. Fields: id, watchId (FK), platformPostId, url, views, likes, shares, comments, engagementRate, isOutlier, templateId (FK, nullable).

**Video** — Main entity. Fields: id, orgId (FK), productId (FK, nullable), templateId (FK, nullable), brandKitId (FK, nullable), batchId (uuid, nullable — groups variants), type (TALKING_HEAD/FACELESS/CLONED), status (QUEUED/SCRAPING/SCRIPTING/GENERATING_AUDIO/GENERATING_AVATAR/COMPOSING/COMPLETED/FAILED), script, scriptVariant (json), avatarId, voiceId, audioUrl, avatarVideoUrl, finalVideoUrl, duration, creditsUsed, error (nullable), publishedAt, publishedUrl, scheduledPublishAt (nullable), tiktokAccountId (FK → TikTokAccount, nullable).

**TikTokAccount** — OAuth tokens. Fields: id, orgId (FK), tikTokUserId, handle, accessToken (encrypted AES-256-GCM), refreshToken (encrypted), tokenExpiresAt, isActive.

### Key Design Decisions

- **Organization-scoped everything** — Prisma middleware enforces orgId filtering on all queries.
- **Template.structure is JSON** — Flexible schema validated at application layer with Zod.
- **Video.batchId groups variants** — No separate Batch table. Query with `WHERE batchId = ?`.
- **Credits are transactional** — Balance denormalized on Organization for fast reads, reconcilable from CreditTransaction log.
- **Encrypted OAuth tokens** — AES-256-GCM at rest.

---

## 5. UI / Pages & Navigation

### Page Structure (Sidebar Navigation)

| Page | Purpose |
|------|---------|
| Dashboard | Credits usage, active jobs, competitor alerts, trending templates, quick actions |
| Create Video | Wizard: product URL → format → avatar/voice → script → brand → generate |
| Clone Viral | Paste URL → watch analysis → scene editor → swap assets → generate variants |
| Templates | Grid with filters (category, industry, format, trending). Tabs: Platform / My Templates / Saved |
| Competitor Intel | Watch list management, outlier feed, one-click clone, engagement charts, weekly digest |
| My Videos | Grid/list of generated videos with status badges, filters, player, download, publish actions |
| Products | Product catalog from scraped URLs |
| Brand Kits | Brand identity management (logo, colors, tone, audience) |
| Asset Library | Uploaded media (images, videos, audio, music) |
| TikTok Accounts | OAuth connection management |
| Settings | Organization settings, team members |
| Billing | Stripe Customer Portal, plan management, usage history |

### Core User Flows

1. **URL → Video (fastest path):** Paste product URL → auto-scrape → pick format + avatar + voice → review AI script → generate (single or batch) → download/publish.
2. **Clone → Customize → Generate:** Paste viral video URL → watch AI deconstruct → review scene timeline → swap in brand assets → AI fits script to structure → generate variants.
3. **Template → Quick Generate:** Browse template library → "Use This Template" → select product → review script → generate.
4. **Competitor Alert → Clone:** Receive outlier alert → view in Competitor Intel → "Clone This" → enters Clone flow.

### UI Stack

- **Components:** shadcn/ui (Radix primitives + Tailwind CSS)
- **Server state:** tRPC + TanStack Query
- **Client state:** Zustand
- **Video preview:** Remotion Player (in-browser preview before rendering)
- **Real-time:** tRPC subscriptions (SSE) for job progress
- **Charts:** Recharts

---

## 6. Third-Party Integrations & Costs

### Service Map

| Service | Purpose | Cost |
|---------|---------|------|
| Gemini 2.5 Flash | Video analysis / viral deconstruction | ~$0.15/M input tokens |
| Claude Sonnet 4.6 | Script generation / copywriting | ~$3/M input, $15/M output |
| ElevenLabs | Text-to-speech + voice library | $0.30/1K chars (Scale tier) |
| D-ID | Avatar talking head generation | ~$0.05/sec of video |
| Clerk | Auth, organizations, user management | Free to $0.02/MAU |
| Stripe | Subscriptions, credit purchases | 2.9% + $0.30/txn |
| Firecrawl | Product page scraping | $19/mo (3K scrapes) |
| Apify | TikTok/Instagram scraping (competitor monitoring + video download fallback) | $49/mo (Actor runs) |
| Resend | Transactional email (alerts, digests) | Free to $20/mo |
| Vercel | Next.js hosting | $20/mo (Pro) |
| Railway | BullMQ workers + Remotion rendering | ~$20-100/mo |
| Supabase | PostgreSQL | $25/mo (Pro) |
| Upstash | Serverless Redis | $10/mo (Pro) |
| Cloudflare R2 | Video/asset storage + CDN | $0.015/GB, $0 egress |

### Per-Video COGS

| Component | Talking Head (15s) | Faceless (15s) |
|-----------|--------------------|----------------|
| Scraping | $0.006 | $0.006 |
| Script (Claude) | $0.02 | $0.02 |
| TTS (ElevenLabs) | $0.10 | $0.10 |
| Avatar (D-ID) | $0.75 | — |
| Remotion render | $0.05 | $0.05 |
| Storage (R2) | $0.001 | $0.001 |
| **Total** | **~$0.93** | **~$0.18** |

3-5x margin when sold as credits.

### Pricing Tiers

| Tier | Price | Credits | Clones | Monitors | Seats | Key Features |
|------|-------|---------|--------|----------|-------|-------------|
| Free | $0/mo | 3 (any type) | 0 | 0 | 1 | Brand watermark, 1 brand kit |
| Starter | $29/mo | 30 | 5/mo | 0 | 1 | No watermark, 3 brand kits, TikTok publishing, template library |
| Growth | $79/mo | 100 | 25/mo | 5 | 3 | Unlimited brand kits, batch generation |
| Scale | $199/mo | 300 | Unlimited | 20 | 10 | Priority rendering, API access |

---

## 7. Content Output, Error Handling & Testing

### Content Output

- **No watermarks** on paid tiers. Free tier has a platform brand watermark (not AI disclosure).
- **No AI metadata** embedded in video files.
- **No forced disclosure labels.** Output is indistinguishable from human-created UGC.
- **TikTok `is_aigc` flag** defaults to `false`. Users can toggle on. **Acknowledged risk:** This is an explicit business decision. TikTok's policy requires accurate AI disclosure; setting this to `false` for AI-generated content may violate their TOS. If TikTok changes enforcement (e.g., auto-detection of AI content), the platform may need to revisit this default. The toggle exists so users can comply if they choose.
- **Full commercial rights** — users own their content, use anywhere, no attribution.
- **Legal responsibility** for advertising disclosure compliance sits with the user per Terms of Service (same model as Creatify, Arcads, all competitors).

### Quality Standards

- Avatar APIs selected for highest realism (D-ID / Creatify Aurora).
- Word-by-word animated captions matching TikTok native style.
- Viral cloning preserves natural rhythm of proven content.
- Claude Sonnet prompts enforce authentic, conversational tone — no "AI slop."

### Error Handling

Credits deducted at job enqueue, refunded on failure. Each step has retry logic:

| Failure | Strategy | Credits |
|---------|----------|---------|
| Scraping | Retry 2x, Firecrawl → Puppeteer fallback, prompt manual entry | No charge |
| Script generation | Retry, fallback to GPT-4o | No charge |
| TTS API | Retry 2x with exponential backoff | Refund |
| Avatar API | Retry 1x, preserve intermediate artifacts for step-retry | Refund |
| Remotion render | Retry 1x, log config, alert engineering | Refund |
| TikTok publish | Video stored; user gets video + error, can retry or download | No extra charge |
| Video download (clone) | yt-dlp → RapidAPI fallback → prompt user to upload file directly | No charge |
| Video analysis (clone) | Retry with higher sampling; inform if video private/deleted | Clone credit only |

### Testing

- **Unit (Vitest):** Credit calculations, Zod schema validation, script prompt logic, pricing/tier logic, data transforms.
- **Integration (Vitest + test DB):** tRPC routers, BullMQ flow execution (mocked APIs), Stripe webhook handling, Clerk auth middleware, credit deduction/refund.
- **E2E (Playwright):** Sign up → create video, clone viral video, billing/plan upgrade. Critical paths only.

### Monitoring

- **Sentry:** Error tracking (Next.js + workers).
- **Bull Board:** Queue health, failed jobs, retry management.
- **Custom dashboard:** API cost tracking per service per day/month.
- **Vercel Analytics:** Frontend performance.

---

## 8. Language Support

English-only at launch. Architecture is language-agnostic from the start:

- Script generation prompts are parameterized by language.
- ElevenLabs and D-ID both support 100+ languages.
- Template structure JSON is language-independent.
- Adding a language is configuration, not re-architecture.

---

## 9. Auto-Publishing

TikTok only at launch.

- **TikTok Content Posting API:** OAuth 2.0, `POST /v2/post/publish/video/init/`, chunked file upload.
- **Rate limits:** 6 init requests/min, ~15 posts/day/creator.
- **Multi-account:** Users connect multiple TikTok accounts via OAuth. Each account is independently managed.
- **Scheduling:** Users can set `scheduledPublishAt` on a video. The Publisher Worker polls for videos past their scheduled time (BullMQ repeatable job, runs every minute).
- **Architecture supports adding Instagram Reels and YouTube Shorts later** (Graph API and Data API v3 respectively).

---

## 10. Infrastructure & Deployment

### Production

| Component | Service | Scaling |
|-----------|---------|---------|
| Frontend + API | Vercel | Auto-scaled (serverless) |
| Workers | Railway | 2-8 instances (horizontal) |
| Database | Supabase PostgreSQL | Managed, vertical scaling |
| Queue | Upstash Redis | Serverless, auto-scaled |
| Storage | Cloudflare R2 | Unlimited |
| CDN | Cloudflare | Global edge |

### Local Development

```
Docker Compose → PostgreSQL + Redis
Turborepo → dev (apps/web + apps/workers concurrently)
Supabase CLI → local database management
.env → API keys
```

### Estimated Monthly Infra Cost

- **Early stage (< 100 users):** ~$100-200/mo
- **Growth (1K users):** ~$500-1,000/mo (dominated by API costs, not infra)
- **Scale:** API costs scale linearly with usage; infra costs scale sub-linearly
