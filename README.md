# ClipFork

**Fork any viral. Ship your version.**

ClipFork is an AI-powered UGC video automation platform that deconstructs proven viral TikTok and Instagram content, letting you rebuild it with your own brand assets. Paste a viral URL, analyze its structure, and generate your own version in minutes.

## Features

- **Viral Structure Cloning** -- Paste any TikTok/Instagram URL. Gemini 2.5 Flash analyzes scenes, hooks, pacing, and engagement patterns. Rebuild the same structure with your product.
- **AI Video Generation** -- Claude Sonnet generates scripts, ElevenLabs creates voiceovers, D-ID produces talking head avatars, and Remotion composes the final video.
- **Competitor Intelligence** -- Monitor competitor accounts, hashtags, and keywords. Auto-detect viral outliers (3x+ average engagement) and clone them with one click.
- **Template Library** -- Save analyzed viral structures as reusable templates. Browse community templates filtered by category, industry, and pacing.
- **TikTok Auto-Publishing** -- Connect TikTok accounts via OAuth. Publish completed videos directly or schedule them for optimal posting times.
- **Brand Kits** -- Define brand colors, tone of voice, and target audience. Every generated video stays on-brand automatically.
- **Credit-Based Billing** -- Four Stripe-powered tiers: Free (3), Starter ($29/mo, 30), Growth ($79/mo, 100), Scale ($199/mo, 300).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Monorepo** | Turborepo + pnpm workspaces |
| **Frontend** | Next.js 15 (App Router), React 19, Tailwind CSS v4, shadcn/ui |
| **API** | tRPC (end-to-end type safety) |
| **Auth** | Clerk (organizations, roles, OAuth) |
| **Database** | PostgreSQL (Supabase) via Prisma ORM |
| **Queue** | BullMQ + Redis (Upstash) |
| **Storage** | Cloudflare R2 (S3-compatible) |
| **AI -- Video Analysis** | Google Gemini 2.5 Flash (native video input) |
| **AI -- Script Generation** | Anthropic Claude Sonnet |
| **AI -- Voice** | ElevenLabs TTS |
| **AI -- Avatar** | D-ID talking head generation |
| **AI -- Video Composition** | Remotion + FFmpeg |
| **Scraping** | Firecrawl (primary) + cheerio (fallback) |
| **Competitor Monitoring** | Apify (TikTok/Instagram) |
| **Payments** | Stripe (subscriptions + customer portal) |
| **Video Download** | yt-dlp + RapidAPI fallback |

## Project Structure

```
ugc/
├── apps/
│   ├── web/                    # Next.js 15 frontend + tRPC API
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (dashboard)/    # 12 authenticated pages
│   │   │   │   │   ├── dashboard/      # Overview, stats, quick actions
│   │   │   │   │   ├── create/         # 4-step video creation wizard
│   │   │   │   │   ├── clone/          # 3-step viral cloning wizard
│   │   │   │   │   ├── templates/      # Public + personal template library
│   │   │   │   │   ├── competitors/    # Competitor watches + viral outliers
│   │   │   │   │   ├── videos/         # Video grid with publish/schedule
│   │   │   │   │   ├── products/       # Product catalog
│   │   │   │   │   ├── brand-kits/     # Brand identity management
│   │   │   │   │   ├── assets/         # Drag-drop media library
│   │   │   │   │   ├── accounts/       # TikTok OAuth connections
│   │   │   │   │   ├── settings/       # Org info, team, API keys
│   │   │   │   │   └── billing/        # Plans, usage, Stripe portal
│   │   │   │   ├── api/
│   │   │   │   │   ├── trpc/[trpc]/    # tRPC HTTP handler
│   │   │   │   │   └── webhooks/       # Clerk + Stripe webhooks
│   │   │   │   ├── sign-in/            # Clerk sign-in
│   │   │   │   ├── sign-up/            # Clerk sign-up
│   │   │   │   ├── page.tsx            # Landing page
│   │   │   │   ├── layout.tsx          # Root layout
│   │   │   │   └── globals.css         # Brand theme variables
│   │   │   ├── components/
│   │   │   │   ├── layout/             # Sidebar, Header
│   │   │   │   ├── providers.tsx       # tRPC + Clerk providers
│   │   │   │   └── ui/                 # shadcn/ui components
│   │   │   ├── lib/
│   │   │   │   ├── trpc.ts             # tRPC client
│   │   │   │   ├── r2.ts              # R2 storage utility
│   │   │   │   └── utils.ts           # cn() helper
│   │   │   └── server/trpc/
│   │   │       ├── init.ts             # tRPC context + procedures
│   │   │       ├── router.ts           # Root router (10 sub-routers)
│   │   │       └── routers/
│   │   │           ├── org.ts          # Organization + members
│   │   │           ├── credits.ts      # Balance + transactions
│   │   │           ├── billing.ts      # Stripe checkout + portal
│   │   │           ├── video.ts        # CRUD + credit deduction
│   │   │           ├── product.ts      # Product catalog CRUD
│   │   │           ├── brandkit.ts     # Brand kit CRUD
│   │   │           ├── asset.ts        # R2 presigned uploads
│   │   │           ├── clone.ts        # Viral analysis + generation
│   │   │           ├── template.ts     # Template library
│   │   │           ├── competitor.ts   # Watches + outliers
│   │   │           └── tiktok.ts       # OAuth + publishing
│   │   └── middleware.ts               # Clerk auth middleware
│   │
│   └── workers/                # BullMQ job processors
│       └── src/
│           ├── index.ts                # Worker registration + shutdown
│           ├── queues.ts               # Queue definitions
│           ├── lib/r2.ts               # R2 utility for workers
│           └── processors/
│               ├── scraper.ts          # Firecrawl + cheerio product scraping
│               ├── script-generator.ts # Claude Sonnet script generation
│               ├── tts.ts              # ElevenLabs text-to-speech
│               ├── avatar.ts           # D-ID talking head video
│               ├── composer.ts         # Remotion video composition (MVP)
│               ├── pipeline.ts         # DAG orchestrator (FlowProducer)
│               ├── video-downloader.ts # yt-dlp + RapidAPI fallback
│               ├── clone-analyzer.ts   # Gemini 2.5 Flash video analysis
│               ├── clone-pipeline.ts   # Clone generation orchestrator
│               ├── monitor.ts          # Apify competitor scanning
│               ├── publisher.ts        # TikTok Content Posting API
│               └── scheduler.ts        # Scheduled publish cron
│
├── packages/
│   ├── db/                     # Prisma schema + client
│   │   └── prisma/
│   │       └── schema.prisma           # 10 entities, 8 enums
│   │
│   └── shared/                 # Shared types, schemas, utilities
│       └── src/
│           ├── types.ts                # TypeScript interfaces
│           ├── schemas.ts              # Zod validation schemas
│           ├── credits.ts              # Credit calculation logic
│           └── crypto.ts               # AES-256-GCM token encryption
│
├── docker-compose.yml          # PostgreSQL + Redis
├── turbo.json                  # Turborepo pipeline config
├── pnpm-workspace.yaml         # Workspace packages
└── .env.example                # All required environment variables
```

## Database Schema

10 entities with full relational integrity:

- **Organization** -- Clerk org sync, plan, credits, Stripe IDs
- **User** -- Clerk user sync, org membership, roles (Owner/Admin/Member)
- **CreditTransaction** -- Purchase/usage/refund/monthly-reset ledger
- **BrandKit** -- Colors, tone of voice, target audience, logo
- **Product** -- Scraped product data, images, reviews
- **Asset** -- Media files stored in R2 (image/video/audio/music)
- **Template** -- Viral structure analysis results (JSON), engagement scores
- **CompetitorWatch** -- Monitored accounts/hashtags/keywords with scan frequency
- **CompetitorPost** -- Discovered posts with engagement metrics, outlier detection
- **Video** -- Full pipeline state machine (QUEUED -> SCRAPING -> SCRIPTING -> GENERATING_AUDIO -> GENERATING_AVATAR -> COMPOSING -> COMPLETED)
- **TikTokAccount** -- OAuth tokens (AES-256-GCM encrypted), publishing config

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL and Redis)

### Setup

```bash
# Clone the repository
git clone https://github.com/viniciusaraujo05/clipfork.git
cd clipfork

# Install dependencies
pnpm install

# Start PostgreSQL and Redis
docker compose up -d

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys (see Environment Variables section below)

# Generate Prisma client and push schema
pnpm db:push

# Start development servers
pnpm dev
```

The web app runs at `http://localhost:3000`. Workers connect to Redis and process jobs automatically.

### Environment Variables

All variables are documented in `.env.example`. At minimum, you need:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Yes | Clerk webhook signing secret |
| `STRIPE_SECRET_KEY` | For billing | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | For billing | Stripe webhook signing secret |
| `R2_ACCOUNT_ID` | For storage | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | For storage | R2 access key |
| `R2_SECRET_ACCESS_KEY` | For storage | R2 secret key |
| `ANTHROPIC_API_KEY` | For scripts | Claude API key |
| `ELEVENLABS_API_KEY` | For voice | ElevenLabs API key |
| `DID_API_KEY` | For avatars | D-ID API key |
| `GOOGLE_AI_API_KEY` | For analysis | Gemini API key |
| `FIRECRAWL_API_KEY` | For scraping | Firecrawl API key |
| `APIFY_API_TOKEN` | For monitoring | Apify API token |
| `TOKEN_ENCRYPTION_KEY` | For TikTok | 32-byte hex key for AES-256-GCM |
| `TIKTOK_CLIENT_KEY` | For publishing | TikTok OAuth client key |
| `TIKTOK_CLIENT_SECRET` | For publishing | TikTok OAuth client secret |

### Scripts

```bash
pnpm dev          # Start all apps in development mode
pnpm build        # Build all packages and apps
pnpm test         # Run all tests
pnpm lint         # Lint all packages
pnpm db:push      # Push Prisma schema to database
pnpm db:migrate   # Create and apply migrations
pnpm db:studio    # Open Prisma Studio GUI
```

## Architecture

### Video Generation Pipeline

```
Product URL ──> Scraper ──> Script Generator ──> TTS ──> Avatar ──> Composer ──> Done
                (Firecrawl)   (Claude Sonnet)  (ElevenLabs) (D-ID)  (Remotion)
```

Jobs are orchestrated as a DAG using BullMQ's FlowProducer. Each step runs as an independent worker with retry logic. Credits are deducted atomically before pipeline start and refunded on failure.

### Viral Cloning Pipeline

```
Viral URL ──> Video Download ──> Gemini Analysis ──> Template ──> Generation Pipeline
              (yt-dlp)          (Gemini 2.5 Flash)   (saved)      (reuses video pipeline)
```

### Competitor Monitoring

```
Watch Config ──> Apify Scan ──> Engagement Calc ──> Outlier Detection ──> Auto-Clone
                 (TikTok/IG)    (views/likes/etc)   (3x avg threshold)    (optional)
```

### Credit System

| Video Type | Cost |
|-----------|------|
| Talking Head | 1 credit per 15s segment |
| Faceless | 0.5 credits per 15s segment |
| Cloned | Varies by scene composition |

## Brand

- **Name:** ClipFork
- **Tagline:** Fork any viral. Ship your version.
- **Colors:** Electric Violet (#7C3AED), Deep Indigo (#1E1B4B), Neon Lime (#A3E635), Snow (#FAFAFA)
- **Font:** Geist Sans

## License

Private. All rights reserved.
