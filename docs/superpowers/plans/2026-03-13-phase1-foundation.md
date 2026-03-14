# Phase 1: Foundation & Core Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational monorepo, database, auth, billing, credit system, worker infrastructure, and UI shell that all subsequent phases build on.

**Architecture:** Turborepo monorepo with `apps/web` (Next.js 15 + tRPC), `apps/workers` (BullMQ processors), `packages/db` (Prisma), and `packages/shared` (types/utils). Clerk for auth, Stripe for billing, Upstash Redis for queues, Supabase PostgreSQL for data, Cloudflare R2 for storage.

**Tech Stack:** TypeScript, Next.js 15 (App Router), tRPC, Prisma, PostgreSQL, BullMQ, Redis, Clerk, Stripe, Cloudflare R2, shadcn/ui, Tailwind CSS, Vitest, Docker Compose.

**Spec reference:** `docs/superpowers/specs/2026-03-13-ugc-platform-design.md`

**Phase scope:** This plan covers infrastructure only. No video generation, cloning, or publishing — those are Phases 2-4.

---

## File Structure

```
ugc/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   │   │   │   └── sign-up/[[...sign-up]]/page.tsx
│   │   │   │   ├── (dashboard)/
│   │   │   │   │   ├── layout.tsx          # Sidebar layout for authenticated pages
│   │   │   │   │   ├── dashboard/page.tsx
│   │   │   │   │   ├── create/page.tsx
│   │   │   │   │   ├── clone/page.tsx
│   │   │   │   │   ├── templates/page.tsx
│   │   │   │   │   ├── competitors/page.tsx
│   │   │   │   │   ├── videos/page.tsx
│   │   │   │   │   ├── products/page.tsx
│   │   │   │   │   ├── brand-kits/page.tsx
│   │   │   │   │   ├── assets/page.tsx
│   │   │   │   │   ├── accounts/page.tsx
│   │   │   │   │   ├── settings/page.tsx
│   │   │   │   │   └── billing/page.tsx
│   │   │   │   ├── api/
│   │   │   │   │   ├── trpc/[trpc]/route.ts
│   │   │   │   │   └── webhooks/stripe/route.ts
│   │   │   │   ├── layout.tsx              # Root layout with Clerk + tRPC providers
│   │   │   │   └── page.tsx               # Landing/redirect
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── sidebar.tsx
│   │   │   │   │   └── header.tsx
│   │   │   │   └── providers.tsx           # ClerkProvider + tRPC provider
│   │   │   ├── lib/
│   │   │   │   ├── trpc.ts                # tRPC React client
│   │   │   │   └── utils.ts               # cn() and helpers
│   │   │   └── server/
│   │   │       ├── trpc/
│   │   │       │   ├── init.ts            # tRPC init, context, middleware
│   │   │       │   ├── router.ts          # Root router
│   │   │       │   └── routers/
│   │   │       │       ├── org.ts         # Organization CRUD
│   │   │       │       ├── credits.ts     # Credit balance, transactions
│   │   │       │       └── billing.ts     # Stripe portal, plan info
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── workers/
│       ├── src/
│       │   ├── index.ts                   # Worker entry, starts all processors
│       │   ├── connection.ts              # Redis connection config
│       │   └── queues.ts                  # Queue + QueueEvents definitions
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── db/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   └── index.ts                   # PrismaClient singleton export
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── shared/
│       ├── src/
│       │   ├── index.ts                   # Barrel export
│       │   ├── types.ts                   # Shared TypeScript types
│       │   ├── schemas.ts                 # Zod schemas (template structure, etc.)
│       │   └── credits.ts                 # Credit calculation pure functions
│       ├── tsconfig.json
│       └── package.json
├── docker-compose.yml
├── turbo.json
├── package.json
├── .env.example
├── .gitignore
└── tsconfig.json                          # Base TypeScript config
```

---

## Chunk 1: Monorepo Scaffolding

### Task 1: Initialize Turborepo Monorepo

**Files:**
- Create: `package.json` (root)
- Create: `turbo.json`
- Create: `tsconfig.json` (root base config)
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`

- [ ] **Step 1: Initialize root package.json**

```json
{
  "name": "ugc",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "db:push": "pnpm --filter @ugc/db db:push",
    "db:migrate": "pnpm --filter @ugc/db db:migrate",
    "db:studio": "pnpm --filter @ugc/db db:studio"
  },
  "devDependencies": {
    "turbo": "^2"
  },
  "packageManager": "pnpm@9.15.4"
}
```

- [ ] **Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 3: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 4: Create root tsconfig.json (base config)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 5: Create .env.example**

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ugc?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# Stripe
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
STRIPE_STARTER_PRICE_ID=""
STRIPE_GROWTH_PRICE_ID=""
STRIPE_SCALE_PRICE_ID=""

# Cloudflare R2
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="ugc-assets"
R2_PUBLIC_URL=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

- [ ] **Step 6: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ugc
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 7: Update .gitignore**

```
node_modules/
.next/
dist/
.env
.env.local
.turbo/
.superpowers/
*.tsbuildinfo
```

- [ ] **Step 8: Install Turborepo and initialize pnpm**

Run: `pnpm install`
Expected: `node_modules` created, `pnpm-lock.yaml` generated.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.json .gitignore .env.example docker-compose.yml pnpm-lock.yaml
git commit -m "feat: initialize Turborepo monorepo with Docker Compose"
```

---

### Task 2: Create `packages/db` (Prisma Schema)

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Create packages/db/package.json**

```json
{
  "name": "@ugc/db",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^6"
  },
  "devDependencies": {
    "prisma": "^6",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create packages/db/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/db/prisma/schema.prisma**

Full schema from spec — all 10 entities:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Plan {
  FREE
  STARTER
  GROWTH
  SCALE
}

enum Role {
  OWNER
  ADMIN
  MEMBER
}

enum CreditTransactionType {
  PURCHASE
  USAGE
  REFUND
  MONTHLY_RESET
}

enum ToneOfVoice {
  CASUAL
  PROFESSIONAL
  HYPE
  EDUCATIONAL
  TESTIMONIAL
}

enum AssetType {
  IMAGE
  VIDEO
  AUDIO
  MUSIC
}

enum Platform {
  TIKTOK
  INSTAGRAM
  YOUTUBE
}

enum WatchType {
  ACCOUNT
  HASHTAG
  KEYWORD
}

enum ScanFrequency {
  DAILY
  TWICE_DAILY
  WEEKLY
}

enum VideoType {
  TALKING_HEAD
  FACELESS
  CLONED
}

enum VideoStatus {
  QUEUED
  SCRAPING
  SCRIPTING
  GENERATING_AUDIO
  GENERATING_AVATAR
  COMPOSING
  COMPLETED
  FAILED
}

model Organization {
  id                   String   @id @default(uuid())
  clerkOrgId           String   @unique
  name                 String
  plan                 Plan     @default(FREE)
  creditsBalance       Int      @default(3)
  creditsMonthly       Int      @default(3)
  stripeCustomerId     String?  @unique
  stripeSubscriptionId String?  @unique
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  users              User[]
  creditTransactions CreditTransaction[]
  brandKits          BrandKit[]
  products           Product[]
  assets             Asset[]
  templates          Template[]
  competitorWatches  CompetitorWatch[]
  videos             Video[]
  tikTokAccounts     TikTokAccount[]
}

model User {
  id          String   @id @default(uuid())
  clerkUserId String   @unique
  orgId       String
  role        Role     @default(MEMBER)
  email       String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId])
}

model CreditTransaction {
  id          String                @id @default(uuid())
  orgId       String
  amount      Int
  type        CreditTransactionType
  referenceId String?
  createdAt   DateTime              @default(now())

  org   Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  video Video?       @relation(fields: [referenceId], references: [id], onDelete: SetNull)

  @@index([orgId])
  @@index([referenceId])
}

model BrandKit {
  id             String      @id @default(uuid())
  orgId          String
  name           String
  logoUrl        String?
  colors         Json        @default("{}")
  toneOfVoice    ToneOfVoice @default(CASUAL)
  targetAudience String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  org      Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  products Product[]
  videos   Video[]

  @@index([orgId])
}

model Product {
  id          String   @id @default(uuid())
  orgId       String
  brandKitId  String?
  name        String
  description String?
  price       String?
  sourceUrl   String?
  images      Json     @default("[]")
  reviews     Json     @default("[]")
  scrapedData Json     @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  org      Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  brandKit BrandKit?    @relation(fields: [brandKitId], references: [id], onDelete: SetNull)
  videos   Video[]

  @@index([orgId])
}

model Asset {
  id        String    @id @default(uuid())
  orgId     String
  type      AssetType
  url       String
  filename  String
  mimeType  String
  sizeBytes Int
  metadata  Json      @default("{}")
  createdAt DateTime  @default(now())

  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId])
}

model Template {
  id              String    @id @default(uuid())
  orgId           String?
  sourceUrl       String?
  sourcePlatform  Platform?
  structure       Json
  category        String?
  industry        String[]  @default([])
  engagementScore Float?
  isPublic        Boolean   @default(false)
  thumbnailUrl    String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  org             Organization?   @relation(fields: [orgId], references: [id], onDelete: Cascade)
  competitorPosts CompetitorPost[]
  videos          Video[]

  @@index([orgId])
  @@index([isPublic])
}

model CompetitorWatch {
  id            String         @id @default(uuid())
  orgId         String
  type          WatchType
  platform      Platform
  value         String
  scanFrequency ScanFrequency  @default(DAILY)
  lastScannedAt DateTime?
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())

  org   Organization     @relation(fields: [orgId], references: [id], onDelete: Cascade)
  posts CompetitorPost[]

  @@index([orgId])
  @@index([isActive])
}

model CompetitorPost {
  id             String   @id @default(uuid())
  watchId        String
  platformPostId String
  url            String
  views          Int      @default(0)
  likes          Int      @default(0)
  shares         Int      @default(0)
  comments       Int      @default(0)
  engagementRate Float    @default(0)
  isOutlier      Boolean  @default(false)
  templateId     String?
  discoveredAt   DateTime @default(now())

  watch    CompetitorWatch @relation(fields: [watchId], references: [id], onDelete: Cascade)
  template Template?       @relation(fields: [templateId], references: [id], onDelete: SetNull)

  @@unique([watchId, platformPostId])
  @@index([watchId])
  @@index([isOutlier])
}

model Video {
  id                 String      @id @default(uuid())
  orgId              String
  productId          String?
  templateId         String?
  brandKitId         String?
  batchId            String?
  type               VideoType
  status             VideoStatus @default(QUEUED)
  script             String?
  scriptVariant      Json?
  avatarId           String?
  voiceId            String?
  audioUrl           String?
  avatarVideoUrl     String?
  finalVideoUrl      String?
  duration           Float?
  creditsUsed        Int         @default(0)
  error              String?
  publishedAt        DateTime?
  publishedUrl       String?
  scheduledPublishAt DateTime?
  tiktokAccountId    String?
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  org            Organization       @relation(fields: [orgId], references: [id], onDelete: Cascade)
  product        Product?           @relation(fields: [productId], references: [id], onDelete: SetNull)
  template       Template?          @relation(fields: [templateId], references: [id], onDelete: SetNull)
  brandKit       BrandKit?          @relation(fields: [brandKitId], references: [id], onDelete: SetNull)
  tiktokAccount  TikTokAccount?     @relation(fields: [tiktokAccountId], references: [id], onDelete: SetNull)
  creditTransactions CreditTransaction[]

  @@index([orgId])
  @@index([batchId])
  @@index([status])
  @@index([scheduledPublishAt])
}

model TikTokAccount {
  id             String   @id @default(uuid())
  orgId          String
  tikTokUserId   String
  handle         String
  accessToken    String
  refreshToken   String
  tokenExpiresAt DateTime
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  org    Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  videos Video[]

  @@unique([orgId, tikTokUserId])
  @@index([orgId])
}
```

- [ ] **Step 4: Create packages/db/src/index.ts**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
```

- [ ] **Step 5: Install dependencies and generate client**

Run:
```bash
cd packages/db && pnpm install && pnpm exec prisma generate
```
Expected: Prisma client generated in `node_modules/.prisma/client`.

- [ ] **Step 6: Start Docker Compose and push schema**

Run:
```bash
docker compose up -d --wait && pnpm db:push
```
Expected: PostgreSQL running on 5432, Redis on 6379, all tables created. `--wait` blocks until services are healthy.

- [ ] **Step 7: Commit**

```bash
git add packages/db/
git commit -m "feat: add Prisma schema with all 10 entities"
```

---

### Task 3: Create `packages/shared` (Types & Credit Logic)

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/schemas.ts`
- Create: `packages/shared/src/credits.ts`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/__tests__/credits.test.ts`

- [ ] **Step 1: Create packages/shared/package.json**

```json
{
  "name": "@ugc/shared",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "^3"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

- [ ] **Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/shared/vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 4: Create packages/shared/src/types.ts**

```typescript
export type Plan = "FREE" | "STARTER" | "GROWTH" | "SCALE";

export type VideoType = "TALKING_HEAD" | "FACELESS" | "CLONED";

export type SceneType =
  | "talking_head"
  | "product_broll"
  | "text_overlay"
  | "testimonial"
  | "greenscreen";

export interface PlanConfig {
  creditsMonthly: number;
  clonesMonthly: number;
  competitorMonitors: number;
  seats: number;
  brandKits: number | "unlimited";
  batchGeneration: boolean;
  apiAccess: boolean;
  watermark: boolean;
  tiktokPublishing: boolean;
  priorityRendering: boolean;
}

export const PLAN_CONFIGS: Record<Plan, PlanConfig> = {
  FREE: {
    creditsMonthly: 3,
    clonesMonthly: 0,
    competitorMonitors: 0,
    seats: 1,
    brandKits: 1,
    batchGeneration: false,
    apiAccess: false,
    watermark: true,
    tiktokPublishing: false,
    priorityRendering: false,
  },
  STARTER: {
    creditsMonthly: 30,
    clonesMonthly: 5,
    competitorMonitors: 0,
    seats: 1,
    brandKits: 3,
    batchGeneration: false,
    apiAccess: false,
    watermark: false,
    tiktokPublishing: true,
    priorityRendering: false,
  },
  GROWTH: {
    creditsMonthly: 100,
    clonesMonthly: 25,
    competitorMonitors: 5,
    seats: 3,
    brandKits: "unlimited",
    batchGeneration: true,
    apiAccess: false,
    watermark: false,
    tiktokPublishing: true,
    priorityRendering: false,
  },
  SCALE: {
    creditsMonthly: 300,
    clonesMonthly: -1, // -1 = unlimited
    competitorMonitors: 20,
    seats: 10,
    brandKits: "unlimited",
    batchGeneration: true,
    apiAccess: true,
    watermark: false,
    tiktokPublishing: true,
    priorityRendering: true,
  },
};
```

- [ ] **Step 5: Create packages/shared/src/schemas.ts**

```typescript
import { z } from "zod";

export const sceneSchema = z.object({
  type: z.enum([
    "talking_head",
    "product_broll",
    "text_overlay",
    "testimonial",
    "greenscreen",
  ]),
  duration_s: z.number().positive(),
  emotion: z.string().optional(),
  gesture: z.string().optional(),
  transition: z.string().optional(),
  text_overlay: z.union([z.boolean(), z.string()]).optional(),
});

export const templateStructureSchema = z.object({
  structure: z.object({
    hook: z.object({
      type: z.string(),
      duration_s: z.number().positive(),
      text_overlay: z.boolean().optional(),
    }),
    scenes: z.array(sceneSchema).min(1),
    cta: z.object({
      type: z.string(),
      duration_s: z.number().positive(),
      text_overlay: z.boolean().optional(),
    }),
  }),
  style: z.object({
    pacing: z.enum(["slow", "medium", "fast"]),
    music_mood: z.string(),
    caption_style: z.string(),
    color_tone: z.string(),
  }),
  format: z.object({
    aspect: z.string().default("9:16"),
    total_duration_s: z.number().positive(),
  }),
});

export type TemplateStructure = z.infer<typeof templateStructureSchema>;
export type Scene = z.infer<typeof sceneSchema>;
```

- [ ] **Step 6: Write failing credit calculation tests**

Create `packages/shared/src/__tests__/credits.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  calculateVideoCredits,
  calculateClonedVideoCredits,
  canAfford,
} from "../credits";
import type { Scene } from "../schemas";

describe("calculateVideoCredits", () => {
  it("returns 1 credit for a talking head video", () => {
    expect(calculateVideoCredits("TALKING_HEAD")).toBe(1);
  });

  it("returns 3 credits for a long talking head video", () => {
    expect(calculateVideoCredits("TALKING_HEAD", 45)).toBe(3);
  });

  it("returns 0.5 credits for a faceless video", () => {
    expect(calculateVideoCredits("FACELESS")).toBe(0.5);
  });

  it("returns 1 credit for a long faceless video", () => {
    expect(calculateVideoCredits("FACELESS", 45)).toBe(1);
  });
});

describe("calculateClonedVideoCredits", () => {
  it("returns 1 credit for a single talking head scene", () => {
    const scenes: Scene[] = [
      { type: "talking_head", duration_s: 5 },
    ];
    expect(calculateClonedVideoCredits(scenes)).toBe(1);
  });

  it("returns 0.25 credits for a single faceless scene", () => {
    const scenes: Scene[] = [
      { type: "product_broll", duration_s: 3 },
    ];
    expect(calculateClonedVideoCredits(scenes)).toBe(0.25);
  });

  it("returns 1.75 for 1 talking head + 3 faceless scenes", () => {
    const scenes: Scene[] = [
      { type: "talking_head", duration_s: 4 },
      { type: "product_broll", duration_s: 3 },
      { type: "text_overlay", duration_s: 2 },
      { type: "testimonial", duration_s: 3 },
    ];
    expect(calculateClonedVideoCredits(scenes)).toBe(1.75);
  });
});

describe("canAfford", () => {
  it("returns true when balance is sufficient", () => {
    expect(canAfford(10, 3)).toBe(true);
  });

  it("returns true when balance equals cost", () => {
    expect(canAfford(3, 3)).toBe(true);
  });

  it("returns false when balance is insufficient", () => {
    expect(canAfford(2, 3)).toBe(false);
  });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `cd packages/shared && pnpm test`
Expected: FAIL — `credits` module does not exist yet.

- [ ] **Step 8: Implement credit calculation logic**

Create `packages/shared/src/credits.ts`:

```typescript
import type { SceneType, VideoType } from "./types";

const TALKING_HEAD_CREDIT_PER_15S = 1;
const FACELESS_CREDIT_PER_15S = 0.5;
const SCENE_CREDITS: Record<SceneType, number> = {
  talking_head: 1,
  product_broll: 0.25,
  text_overlay: 0.25,
  testimonial: 0.25,
  greenscreen: 0.25,
};

export function calculateVideoCredits(
  type: VideoType,
  durationSeconds: number = 15
): number {
  if (type === "CLONED") {
    throw new Error(
      "Use calculateClonedVideoCredits() for CLONED videos — requires scene list"
    );
  }
  const segments = Math.ceil(durationSeconds / 15);
  if (type === "TALKING_HEAD") {
    return segments * TALKING_HEAD_CREDIT_PER_15S;
  }
  return segments * FACELESS_CREDIT_PER_15S;
}

export function calculateClonedVideoCredits(
  scenes: { type: SceneType }[]
): number {
  return scenes.reduce((total, scene) => {
    return total + (SCENE_CREDITS[scene.type] ?? 0.25);
  }, 0);
}

export function canAfford(balance: number, cost: number): boolean {
  return balance >= cost;
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd packages/shared && pnpm test`
Expected: All 7 tests PASS.

- [ ] **Step 10: Create packages/shared/src/index.ts (barrel export)**

```typescript
export * from "./types";
export * from "./schemas";
export * from "./credits";
```

- [ ] **Step 11: Install dependencies**

Run: `cd packages/shared && pnpm install`

- [ ] **Step 12: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types, Zod schemas, and credit calculation with tests"
```

---

### Task 4: Scaffold Next.js App (`apps/web`)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/src/lib/utils.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/globals.css`

- [ ] **Step 1: Create apps/web/package.json**

```json
{
  "name": "@ugc/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@clerk/nextjs": "^6",
    "@tanstack/react-query": "^5",
    "@trpc/client": "^11",
    "@trpc/react-query": "^11",
    "@trpc/server": "^11",
    "@ugc/db": "workspace:*",
    "@ugc/shared": "workspace:*",
    "class-variance-authority": "^0.7",
    "clsx": "^2",
    "lucide-react": "^0.468",
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "stripe": "^17",
    "superjson": "^2",
    "tailwind-merge": "^2",
    "zod": "^3",
    "zustand": "^5"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "autoprefixer": "^10",
    "postcss": "^8",
    "tailwindcss": "^3",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create apps/web/next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ugc/db", "@ugc/shared"],
};

export default nextConfig;
```

- [ ] **Step 3: Create apps/web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", "*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create apps/web/tailwind.config.ts**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Create apps/web/postcss.config.js**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create apps/web/src/app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Create apps/web/src/lib/utils.ts**

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 8: Create apps/web/src/app/layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UGC Platform",
  description: "AI-powered UGC video automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Create apps/web/src/app/page.tsx**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 10: Install dependencies**

Run: `cd apps/web && pnpm install`

- [ ] **Step 11: Verify Next.js builds**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds.

- [ ] **Step 12: Commit**

```bash
git add apps/web/
git commit -m "feat: scaffold Next.js 15 app with Tailwind CSS"
```

---

### Task 5: Scaffold Worker App (`apps/workers`)

**Files:**
- Create: `apps/workers/package.json`
- Create: `apps/workers/tsconfig.json`
- Create: `apps/workers/src/connection.ts`
- Create: `apps/workers/src/queues.ts`
- Create: `apps/workers/src/index.ts`

- [ ] **Step 1: Create apps/workers/package.json**

```json
{
  "name": "@ugc/workers",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@ugc/db": "workspace:*",
    "@ugc/shared": "workspace:*",
    "bullmq": "^5",
    "ioredis": "^5"
  },
  "devDependencies": {
    "tsx": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create apps/workers/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create apps/workers/src/connection.ts**

```typescript
import IORedis from "ioredis";

export function createRedisConnection() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new IORedis(url, { maxRetriesPerRequest: null });
}
```

- [ ] **Step 4: Create apps/workers/src/queues.ts**

```typescript
import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";

const connection = createRedisConnection();

export const videoQueue = new Queue("video", { connection });
export const cloneQueue = new Queue("clone", { connection });
export const monitorQueue = new Queue("monitor", { connection });
export const publishQueue = new Queue("publish", { connection });

export const QUEUE_NAMES = {
  VIDEO: "video",
  CLONE: "clone",
  MONITOR: "monitor",
  PUBLISH: "publish",
} as const;
```

- [ ] **Step 5: Create apps/workers/src/index.ts**

```typescript
import { createRedisConnection } from "./connection";

async function main() {
  const connection = createRedisConnection();

  console.log("Workers starting...");
  console.log("Redis connected:", connection.status);

  // Workers will be registered here in Phase 2+
  console.log("No processors registered yet (Phase 1 — infrastructure only)");
  console.log("Workers idle, waiting for processor registration...");

  process.on("SIGTERM", async () => {
    console.log("Shutting down workers...");
    await connection.quit();
    process.exit(0);
  });
}

main().catch(console.error);
```

- [ ] **Step 6: Install dependencies**

Run: `cd apps/workers && pnpm install`

- [ ] **Step 7: Verify worker starts**

Run:
```bash
docker compose up -d && cd apps/workers && pnpm dev
```
Expected: "Workers starting..." logged, no errors. Kill with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add apps/workers/
git commit -m "feat: scaffold BullMQ worker app with Redis connection and queue definitions"
```

- [ ] **Step 9: Run full monorepo install and verify**

Run:
```bash
cd /Users/vinicius/code/ugc && pnpm install
```
Expected: All workspace packages resolved, no errors.

- [ ] **Step 10: Commit lockfile**

```bash
git add pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "chore: add pnpm lockfile and workspace config"
```

---

## Chunk 2: Auth, Billing & tRPC

### Task 6: Clerk Authentication

**Files:**
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/components/providers.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- Create: `apps/web/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: Create Clerk middleware**

Create `apps/web/src/middleware.ts`:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 2: Create providers component**

Create `apps/web/src/components/providers.tsx`:

```tsx
"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import superjson from "superjson";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <ClerkProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </trpc.Provider>
    </ClerkProvider>
  );
}
```

- [ ] **Step 3: Update root layout to use providers**

Replace `apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "UGC Platform",
  description: "AI-powered UGC video automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Create sign-in page**

Create `apps/web/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`:

```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
```

- [ ] **Step 5: Create sign-up page**

Create `apps/web/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`:

```tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
```

- [ ] **Step 6: Verify auth works**

Run: `cd apps/web && pnpm dev`
Expected: Visiting `http://localhost:3000` redirects to `/sign-in`. Sign-in page renders Clerk component (needs valid Clerk keys in `.env.local` to fully work).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/src/components/providers.tsx apps/web/src/app/layout.tsx apps/web/src/app/\(auth\)/
git commit -m "feat: add Clerk authentication with sign-in/sign-up pages"
```

---

### Task 7: Clerk Webhook (User/Org Sync)

**Files:**
- Create: `apps/web/src/app/api/webhooks/clerk/route.ts`

Without this, Clerk users exist only in Clerk — our database would have no User or Organization records, and every tRPC `protectedProcedure` call would fail with "User not found."

- [ ] **Step 1: Install svix (Clerk webhook verification)**

Run: `cd apps/web && pnpm add svix`

- [ ] **Step 2: Add Clerk webhook secret to .env.example**

Add `CLERK_WEBHOOK_SECRET=""` to `.env.example`.

- [ ] **Step 3: Create Clerk webhook handler**

Create `apps/web/src/app/api/webhooks/clerk/route.ts`:

```typescript
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@ugc/db";

interface ClerkUserEvent {
  data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    organization_memberships?: Array<{
      organization: { id: string; name: string };
      role: string;
    }>;
  };
  type: string;
}

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  let event: ClerkUserEvent;

  try {
    event = wh.verify(body, {
      "svix-id": headersList.get("svix-id")!,
      "svix-timestamp": headersList.get("svix-timestamp")!,
      "svix-signature": headersList.get("svix-signature")!,
    }) as ClerkUserEvent;
  } catch (err) {
    console.error("Clerk webhook verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = event;
  const email = data.email_addresses[0]?.email_address ?? "";

  if (type === "user.created") {
    // Create a personal organization for the user
    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `personal_${data.id}`,
        name: email.split("@")[0] ?? "My Workspace",
      },
    });

    await prisma.user.create({
      data: {
        clerkUserId: data.id,
        orgId: org.id,
        role: "OWNER",
        email,
      },
    });
  }

  if (type === "user.updated") {
    await prisma.user.updateMany({
      where: { clerkUserId: data.id },
      data: { email },
    });
  }

  if (type === "user.deleted") {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: data.id },
    });
    if (user) {
      // If they're the only user in the org, delete the org too
      const orgUserCount = await prisma.user.count({
        where: { orgId: user.orgId },
      });
      await prisma.user.delete({ where: { id: user.id } });
      if (orgUserCount <= 1) {
        await prisma.organization.delete({ where: { id: user.orgId } });
      }
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 4: Verify endpoint exists**

Run: `curl -X POST http://localhost:3000/api/webhooks/clerk -d '{}' -H "Content-Type: application/json"`
Expected: Returns `400` with "Invalid signature" (confirms route is active).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/webhooks/clerk/ .env.example
git commit -m "feat: add Clerk webhook to sync users and organizations to database"
```

---

### Task 8: tRPC Setup

**Files:**
- Create: `apps/web/src/lib/trpc.ts`
- Create: `apps/web/src/server/trpc/init.ts`
- Create: `apps/web/src/server/trpc/router.ts`
- Create: `apps/web/src/server/trpc/routers/org.ts`
- Create: `apps/web/src/server/trpc/routers/credits.ts`
- Create: `apps/web/src/server/trpc/routers/billing.ts`
- Create: `apps/web/src/app/api/trpc/[trpc]/route.ts`

- [ ] **Step 1: Create tRPC React client**

Create `apps/web/src/lib/trpc.ts`:

```typescript
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/trpc/router";

export const trpc = createTRPCReact<AppRouter>();
```

- [ ] **Step 2: Create tRPC init (context + middleware)**

Create `apps/web/src/server/trpc/init.ts`:

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@ugc/db";
import superjson from "superjson";

export async function createTRPCContext() {
  const { userId, orgId } = await auth();
  return { userId, orgId, prisma };
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  // Look up the user's organization
  const user = await ctx.prisma.user.findUnique({
    where: { clerkUserId: ctx.userId },
    include: { org: true },
  });
  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User not found. Complete onboarding first.",
    });
  }
  return next({
    ctx: { ...ctx, user, org: user.org },
  });
});
```

- [ ] **Step 3: Create org router**

Create `apps/web/src/server/trpc/routers/org.ts`:

```typescript
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
```

- [ ] **Step 4: Create credits router**

Create `apps/web/src/server/trpc/routers/credits.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../init";

export const creditsRouter = router({
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    return {
      balance: ctx.org.creditsBalance,
      monthly: ctx.org.creditsMonthly,
      plan: ctx.org.plan,
    };
  }),

  getTransactions: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const transactions = await ctx.prisma.creditTransaction.findMany({
        where: { orgId: ctx.org.id },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (transactions.length > input.limit) {
        const next = transactions.pop();
        nextCursor = next?.id;
      }

      return { transactions, nextCursor };
    }),
});
```

- [ ] **Step 5: Create billing router**

Create `apps/web/src/server/trpc/routers/billing.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../init";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export const billingRouter = router({
  getPlan: protectedProcedure.query(async ({ ctx }) => {
    return {
      plan: ctx.org.plan,
      creditsBalance: ctx.org.creditsBalance,
      creditsMonthly: ctx.org.creditsMonthly,
    };
  }),

  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.org.stripeCustomerId) {
      const customer = await stripe.customers.create({
        metadata: { orgId: ctx.org.id },
      });
      await ctx.prisma.organization.update({
        where: { id: ctx.org.id },
        data: { stripeCustomerId: customer.id },
      });
      ctx.org.stripeCustomerId = customer.id;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: ctx.org.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    });

    return { url: session.url };
  }),

  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        priceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.org.stripeCustomerId) {
        const customer = await stripe.customers.create({
          metadata: { orgId: ctx.org.id },
        });
        await ctx.prisma.organization.update({
          where: { id: ctx.org.id },
          data: { stripeCustomerId: customer.id },
        });
        ctx.org.stripeCustomerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create({
        customer: ctx.org.stripeCustomerId,
        line_items: [{ price: input.priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
      });

      return { url: session.url };
    }),
});
```

- [ ] **Step 6: Create root router**

Create `apps/web/src/server/trpc/router.ts`:

```typescript
import { router } from "./init";
import { orgRouter } from "./routers/org";
import { creditsRouter } from "./routers/credits";
import { billingRouter } from "./routers/billing";

export const appRouter = router({
  org: orgRouter,
  credits: creditsRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 7: Create API route handler**

Create `apps/web/src/app/api/trpc/[trpc]/route.ts`:

```typescript
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/router";
import { createTRPCContext } from "@/server/trpc/init";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
```

- [ ] **Step 8: Verify tRPC endpoint responds**

Run: `cd apps/web && pnpm dev`
Then: `curl http://localhost:3000/api/trpc/credits.getBalance`
Expected: Returns `401 UNAUTHORIZED` (no auth token — confirms tRPC is working and auth middleware is active).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/trpc.ts apps/web/src/server/ apps/web/src/app/api/trpc/
git commit -m "feat: add tRPC with org, credits, and billing routers"
```

---

### Task 9: Stripe Webhook Handler

**Files:**
- Create: `apps/web/src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Create Stripe webhook handler**

Create `apps/web/src/app/api/webhooks/stripe/route.ts`:

```typescript
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@ugc/db";
import { PLAN_CONFIGS, type Plan } from "@ugc/shared";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const PRICE_TO_PLAN: Record<string, Plan> = {
  [process.env.STRIPE_STARTER_PRICE_ID!]: "STARTER",
  [process.env.STRIPE_GROWTH_PRICE_ID!]: "GROWTH",
  [process.env.STRIPE_SCALE_PRICE_ID!]: "SCALE",
};

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription && session.customer) {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const priceId = subscription.items.data[0]?.price.id;
        const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined;
        if (plan) {
          const config = PLAN_CONFIGS[plan];
          await prisma.organization.update({
            where: { stripeCustomerId: session.customer as string },
            data: {
              plan,
              stripeSubscriptionId: subscription.id,
              creditsBalance: config.creditsMonthly,
              creditsMonthly: config.creditsMonthly,
            },
          });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined;
      if (plan && subscription.customer) {
        const config = PLAN_CONFIGS[plan];
        await prisma.organization.update({
          where: { stripeCustomerId: subscription.customer as string },
          data: {
            plan,
            creditsMonthly: config.creditsMonthly,
          },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.customer) {
        await prisma.organization.update({
          where: { stripeCustomerId: subscription.customer as string },
          data: {
            plan: "FREE",
            stripeSubscriptionId: null,
            creditsBalance: PLAN_CONFIGS.FREE.creditsMonthly,
            creditsMonthly: PLAN_CONFIGS.FREE.creditsMonthly,
          },
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription && invoice.customer && invoice.billing_reason === "subscription_cycle") {
        const org = await prisma.organization.findUnique({
          where: { stripeCustomerId: invoice.customer as string },
        });
        if (org) {
          const config = PLAN_CONFIGS[org.plan];
          await prisma.$transaction([
            prisma.organization.update({
              where: { id: org.id },
              data: { creditsBalance: config.creditsMonthly },
            }),
            prisma.creditTransaction.create({
              data: {
                orgId: org.id,
                amount: config.creditsMonthly,
                type: "MONTHLY_RESET",
              },
            }),
          ]);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 2: Verify endpoint exists**

Run: `curl -X POST http://localhost:3000/api/webhooks/stripe -d '{}' -H "Content-Type: application/json"`
Expected: Returns `400` with "Invalid signature" (no valid Stripe signature — confirms route is active).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/webhooks/stripe/
git commit -m "feat: add Stripe webhook handler for subscriptions and monthly credit reset"
```

---

## Chunk 3: UI Shell & Dashboard Layout

### Task 10: Install shadcn/ui and Create Layout Components

**Files:**
- Create: `apps/web/src/components/layout/sidebar.tsx`
- Create: `apps/web/src/components/layout/header.tsx`
- Create: `apps/web/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Initialize shadcn/ui**

Run:
```bash
cd apps/web && pnpm dlx shadcn@latest init -d
```
Expected: `components.json` created, `lib/utils.ts` updated, CSS variables added to `globals.css`.

- [ ] **Step 2: Add required shadcn/ui components**

Run:
```bash
cd apps/web && pnpm dlx shadcn@latest add button avatar dropdown-menu separator tooltip badge
```
Expected: Components added to `src/components/ui/`.

- [ ] **Step 3: Create sidebar component**

Create `apps/web/src/components/layout/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PlusCircle,
  Copy,
  LayoutTemplate,
  Eye,
  Video,
  Package,
  Palette,
  ImageIcon,
  Settings,
  CreditCard,
  MonitorPlay,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Create Video", icon: PlusCircle },
  { href: "/clone", label: "Clone Viral", icon: Copy },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/competitors", label: "Competitor Intel", icon: Eye },
  { href: "/videos", label: "My Videos", icon: Video },
  { href: "/products", label: "Products", icon: Package },
  { href: "/brand-kits", label: "Brand Kits", icon: Palette },
  { href: "/assets", label: "Asset Library", icon: ImageIcon },
];

const bottomNav = [
  { href: "/accounts", label: "TikTok Accounts", icon: MonitorPlay },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="flex h-screen w-64 flex-col border-r bg-white">
        <div className="flex h-14 items-center px-4 font-semibold text-lg">
          UGC Platform
        </div>
        <Separator />
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        pathname === item.href
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="lg:hidden">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        </nav>
        <Separator />
        <nav className="px-2 py-4">
          <ul className="space-y-1">
            {bottomNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </TooltipProvider>
  );
}
```

- [ ] **Step 4: Create header component**

Create `apps/web/src/components/layout/header.tsx`:

```tsx
import { UserButton } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";

export function Header({ creditsBalance }: { creditsBalance?: number }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        {creditsBalance !== undefined && (
          <Badge variant="secondary" className="text-sm">
            {creditsBalance} credits
          </Badge>
        )}
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Create dashboard layout**

Create `apps/web/src/app/(dashboard)/layout.tsx`:

```tsx
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ apps/web/src/app/\(dashboard\)/layout.tsx apps/web/components.json
git commit -m "feat: add sidebar navigation, header, and dashboard layout shell"
```

---

### Task 11: Create All Page Stubs

**Files:**
- Create: 12 page stub files under `apps/web/src/app/(dashboard)/`

- [ ] **Step 1: Create dashboard page**

Create `apps/web/src/app/(dashboard)/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-gray-500">
        Overview of your account, credits, and recent activity.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create create video page**

Create `apps/web/src/app/(dashboard)/create/page.tsx`:

```tsx
export default function CreateVideoPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Create Video</h1>
      <p className="mt-2 text-gray-500">
        Generate UGC videos from a product URL or your catalog.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create clone viral page**

Create `apps/web/src/app/(dashboard)/clone/page.tsx`:

```tsx
export default function CloneViralPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Clone Viral</h1>
      <p className="mt-2 text-gray-500">
        Paste a TikTok or Reel URL to deconstruct its viral structure.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Create templates page**

Create `apps/web/src/app/(dashboard)/templates/page.tsx`:

```tsx
export default function TemplatesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Templates</h1>
      <p className="mt-2 text-gray-500">
        Browse viral templates or manage your saved structures.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Create competitors page**

Create `apps/web/src/app/(dashboard)/competitors/page.tsx`:

```tsx
export default function CompetitorsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Competitor Intel</h1>
      <p className="mt-2 text-gray-500">
        Monitor competitor accounts and discover viral outliers.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Create videos page**

Create `apps/web/src/app/(dashboard)/videos/page.tsx`:

```tsx
export default function VideosPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">My Videos</h1>
      <p className="mt-2 text-gray-500">
        View, download, and publish your generated videos.
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Create products page**

Create `apps/web/src/app/(dashboard)/products/page.tsx`:

```tsx
export default function ProductsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Products</h1>
      <p className="mt-2 text-gray-500">
        Manage your product catalog for video generation.
      </p>
    </div>
  );
}
```

- [ ] **Step 8: Create brand kits page**

Create `apps/web/src/app/(dashboard)/brand-kits/page.tsx`:

```tsx
export default function BrandKitsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Brand Kits</h1>
      <p className="mt-2 text-gray-500">
        Define your brand identity: logo, colors, tone, and audience.
      </p>
    </div>
  );
}
```

- [ ] **Step 9: Create assets page**

Create `apps/web/src/app/(dashboard)/assets/page.tsx`:

```tsx
export default function AssetsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Asset Library</h1>
      <p className="mt-2 text-gray-500">
        Upload and manage images, videos, audio, and music.
      </p>
    </div>
  );
}
```

- [ ] **Step 10: Create accounts page**

Create `apps/web/src/app/(dashboard)/accounts/page.tsx`:

```tsx
export default function AccountsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">TikTok Accounts</h1>
      <p className="mt-2 text-gray-500">
        Connect and manage your TikTok accounts for auto-publishing.
      </p>
    </div>
  );
}
```

- [ ] **Step 11: Create settings page**

Create `apps/web/src/app/(dashboard)/settings/page.tsx`:

```tsx
export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-gray-500">
        Organization settings and team management.
      </p>
    </div>
  );
}
```

- [ ] **Step 12: Create billing page**

Create `apps/web/src/app/(dashboard)/billing/page.tsx`:

```tsx
export default function BillingPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Billing</h1>
      <p className="mt-2 text-gray-500">
        Manage your subscription, view usage, and update payment methods.
      </p>
    </div>
  );
}
```

- [ ] **Step 13: Verify all pages render**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds with all 12 pages compiled.

- [ ] **Step 14: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/
git commit -m "feat: add all 12 dashboard page stubs with sidebar navigation"
```

---

### Task 12: R2 Storage Utility

**Files:**
- Create: `apps/web/src/lib/r2.ts`

- [ ] **Step 1: Install AWS S3 SDK**

Run: `cd apps/web && pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`

- [ ] **Step 2: Create R2 client utility**

Create `apps/web/src/lib/r2.ts`:

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array | ReadableStream,
  contentType: string
): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn }
  );
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
    { expiresIn }
  );
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/r2.ts apps/web/package.json
git commit -m "feat: add Cloudflare R2 storage utility with presigned URL support"
```

---

### Task 13: Final Verification & Cleanup

- [ ] **Step 1: Run full monorepo install**

Run: `cd /Users/vinicius/code/ugc && pnpm install`
Expected: All packages install cleanly.

- [ ] **Step 2: Run shared package tests**

Run: `pnpm test`
Expected: All credit calculation tests pass.

- [ ] **Step 3: Build web app**

Run: `pnpm build`
Expected: Next.js build succeeds.

- [ ] **Step 4: Start dev and verify navigation**

Run: `pnpm dev`
Expected: Web app at `http://localhost:3000`, sidebar navigation works, all 12 pages accessible.

- [ ] **Step 5: Commit lockfile updates**

```bash
git add pnpm-lock.yaml
git commit -m "chore: update lockfile after all Phase 1 dependencies"
```
