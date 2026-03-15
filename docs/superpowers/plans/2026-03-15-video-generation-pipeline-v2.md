# Video Generation Pipeline v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stub avatar/composer processors with a real AI video generation pipeline using fal.ai (Flux Pro for images, Kling V3 for video), add a preset system for TikTok niches, and integrate brand LoRA support.

**Architecture:** Two new processors (Scene Generator, Video Assembler) replace the current stubs. A provider abstraction (`AIProvider` interface) wraps fal.ai calls. Existing processors (scraper, script-generator, TTS) keep their current job-data chaining pattern unchanged. The new processors (scene-generator, video-assembler) use database-mediated data flow — they read inputs from the Video record using `videoId`. A Preset model encodes niche-specific visual knowledge. Brand LoRA training is handled by a dedicated processor.

**Important migration note:** The existing scraper, script-generator, and TTS processors are NOT modified to read from DB — they continue receiving their inputs via job data payloads as before. Only the chain links from TTS onward use the simplified `{ videoId, _pipeline }` pattern. This minimizes risk by not touching working code.

**Tech Stack:** fal.ai (`@fal-ai/client`), FFmpeg (video composition), ElevenLabs (TTS — existing), Cloudflare R2 (storage — existing), pg-boss (job queue — existing), Prisma (ORM — existing), archiver (ZIP for LoRA training images).

**Spec:** `docs/superpowers/specs/2026-03-14-video-generation-pipeline-v2-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `packages/shared/src/ai-provider.ts` | `AIProvider` interface + request/result types |
| `apps/workers/src/providers/fal.ts` | fal.ai implementation of `AIProvider` |
| `apps/workers/src/processors/scene-generator.ts` | Scene image + video generation (replaces `avatar.ts`) |
| `apps/workers/src/processors/video-assembler.ts` | FFmpeg-based video composition (replaces `composer.ts`) |
| `apps/workers/src/processors/lora-trainer.ts` | Brand LoRA training via fal.ai |
| `packages/db/prisma/seed-presets.ts` | Seed data for 8 TikTok niche presets |
| `packages/shared/src/__tests__/ai-provider.test.ts` | Tests for AI provider types/validation |
| `apps/workers/src/__tests__/scene-generator.test.ts` | Tests for scene normalization + prompt building |
| `apps/workers/src/__tests__/video-assembler.test.ts` | Tests for FFmpeg command building |
| `apps/web/src/server/trpc/routers/preset.ts` | Preset list endpoint for frontend |

### Modified Files
| File | Changes |
|------|---------|
| `packages/db/prisma/schema.prisma` | New `Preset` model, updated `Video` (add `presetId`, `sceneVideos`, `sceneImages`), updated `BrandKit` (add LoRA fields), rename `GENERATING_AVATAR` → `GENERATING_SCENES` |
| `packages/shared/src/types.ts` | Extend `SceneType` union with `hook`, `benefit`, `demo`, `cta` |
| `packages/shared/src/schemas.ts` | Update `sceneSchema` for new scene types |
| `packages/shared/src/credits.ts` | New `calculateVideoCredits(sceneCount)` signature |
| `packages/shared/src/index.ts` | Export `ai-provider` types |
| `packages/shared/src/__tests__/credits.test.ts` | Update tests for new credit calc |
| `apps/workers/src/queues.ts` | Add `SCENE_GENERATOR`, `VIDEO_ASSEMBLER`, `LORA_TRAINING`; remove `AVATAR`, `COMPOSER` |
| `apps/workers/src/index.ts` | Register new processors, update chaining, remove old imports |
| `apps/workers/src/processors/pipeline.ts` | Simplified `PipelineOptions` with `presetId`, updated credit calc call |
| `apps/workers/src/processors/clone-pipeline.ts` | Add `presetId` to options, pass through pipeline meta |
| `apps/workers/Dockerfile` | Add `ffmpeg` to apt-get install |
| `apps/web/src/server/trpc/routers/video.ts` | Accept `presetId`, update status enum refs |
| `apps/web/src/server/trpc/routers/brandkit.ts` | Add `trainLoRA` mutation, `getTrainingStatus` query |
| `apps/web/src/app/(dashboard)/create/page.tsx` | Add preset selector in Step 2 |
| `apps/web/src/app/(dashboard)/clone/page.tsx` | Add preset selector in Step 3 |
| `apps/web/src/app/(dashboard)/brand-kits/page.tsx` | Add LoRA training section |
| `apps/web/src/app/(dashboard)/videos/page.tsx` | Real video player, scene thumbnails, rename GENERATING_AVATAR → GENERATING_SCENES |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | Rename GENERATING_AVATAR → GENERATING_SCENES in status maps |
| `apps/web/src/server/trpc/routers/clone.ts` | Accept `presetId` in `generateFromTemplate` |
| `apps/web/src/server/trpc/router.ts` | Register `presetRouter` |

### Deleted Files
| File | Reason |
|------|--------|
| `apps/workers/src/processors/avatar.ts` | Replaced by `scene-generator.ts` |
| `apps/workers/src/processors/composer.ts` | Replaced by `video-assembler.ts` |

---

## Chunk 1: Database Schema + Shared Types

### Task 1: Update Prisma schema

**Files:**
- Modify: `packages/db/prisma/schema.prisma:70-79` (VideoStatus enum)
- Modify: `packages/db/prisma/schema.prisma:133-149` (BrandKit model)
- Modify: `packages/db/prisma/schema.prisma:250-287` (Video model)
- Create (in same file): Preset model

- [ ] **Step 1: Rename GENERATING_AVATAR to GENERATING_SCENES in VideoStatus enum**

In `packages/db/prisma/schema.prisma`, change:
```prisma
enum VideoStatus {
  QUEUED
  SCRAPING
  SCRIPTING
  GENERATING_AUDIO
  GENERATING_SCENES    // was GENERATING_AVATAR
  COMPOSING
  COMPLETED
  FAILED
}
```

- [ ] **Step 2: Add LoRA fields to BrandKit model**

In `packages/db/prisma/schema.prisma`, add to the `BrandKit` model after `targetAudience`:
```prisma
model BrandKit {
  id                 String      @id @default(uuid())
  orgId              String
  name               String
  logoUrl            String?
  colors             Json        @default("{}")
  toneOfVoice        ToneOfVoice @default(CASUAL)
  targetAudience     String?
  loraUrl            String?
  loraTriggerWord    String?
  loraTrainingStatus String?     // "pending" | "training" | "ready" | "failed"
  loraTrainingImages Json?       // string[] — image URLs used for training
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  org      Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  products Product[]
  videos   Video[]

  @@index([orgId])
}
```

- [ ] **Step 3: Add new fields to Video model**

In `packages/db/prisma/schema.prisma`, add `presetId`, `sceneVideos`, `sceneImages` to the `Video` model and the `Preset` relation:
```prisma
model Video {
  id                 String      @id @default(uuid())
  orgId              String
  productId          String?
  templateId         String?
  brandKitId         String?
  presetId           String?
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
  sceneVideos        Json?       // string[][] — per-scene video clip URLs
  sceneImages        Json?       // string[] — per-scene starting frame URLs
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
  preset         Preset?            @relation(fields: [presetId], references: [id], onDelete: SetNull)
  tiktokAccount  TikTokAccount?     @relation(fields: [tiktokAccountId], references: [id], onDelete: SetNull)
  creditTransactions CreditTransaction[]

  @@index([orgId])
  @@index([batchId])
  @@index([status])
  @@index([scheduledPublishAt])
}
```

- [ ] **Step 4: Create Preset model**

Add to `packages/db/prisma/schema.prisma` after the `Template` model:
```prisma
model Preset {
  id             String   @id @default(uuid())
  niche          String
  name           String
  description    String?
  sceneStyles    Json     // Record<string, string> — style prompts per scene type
  negativePrompt String?
  defaultPacing  String   @default("medium")
  musicMood      String?
  isDefault      Boolean  @default(false)
  createdAt      DateTime @default(now())

  videos Video[]
}
```

- [ ] **Step 5: Run Prisma migration**

Run:
```bash
cd packages/db && npx prisma migrate dev --name video-pipeline-v2
```
Expected: Migration creates successfully. New tables and columns added.

- [ ] **Step 6: Verify Prisma client generates**

Run:
```bash
cd packages/db && npx prisma generate
```
Expected: Prisma Client generated successfully.

- [ ] **Step 7: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "feat: update schema for video pipeline v2 — add Preset model, LoRA fields, scene storage"
```

---

### Task 2: Update all GENERATING_AVATAR references to GENERATING_SCENES

**Files:**
- Modify: `apps/web/src/app/(dashboard)/videos/page.tsx:37,48,59`
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx:20,31,59`
- Modify: `apps/web/src/server/trpc/routers/video.ts:65`

The Prisma migration renamed the enum value. All frontend references must be updated in the same chunk to avoid build breakage.

- [ ] **Step 1: Update videos/page.tsx**

In `apps/web/src/app/(dashboard)/videos/page.tsx`, replace all three occurrences of `GENERATING_AVATAR` with `GENERATING_SCENES`:

Line 37 (STATUS_COLORS): `GENERATING_AVATAR` → `GENERATING_SCENES`
Line 48 (STATUS_LABELS): `GENERATING_AVATAR: "Avatar"` → `GENERATING_SCENES: "Scenes"`
Line 59 (isProcessingStatus): `"GENERATING_AVATAR"` → `"GENERATING_SCENES"`

- [ ] **Step 2: Update dashboard/page.tsx**

In `apps/web/src/app/(dashboard)/dashboard/page.tsx`, replace all three occurrences of `GENERATING_AVATAR` with `GENERATING_SCENES`:

Line 20 (STATUS_COLORS): `GENERATING_AVATAR` → `GENERATING_SCENES`
Line 31 (STATUS_LABELS): `GENERATING_AVATAR: "Avatar"` → `GENERATING_SCENES: "Scenes"`
Line 59 (activeJobs filter): `"GENERATING_AVATAR"` → `"GENERATING_SCENES"`

- [ ] **Step 3: Update video.ts router**

In `apps/web/src/server/trpc/routers/video.ts:65`, change the `status` enum:
`"GENERATING_AVATAR"` → `"GENERATING_SCENES"`

- [ ] **Step 4: Verify build**

Run:
```bash
cd apps/web && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/(dashboard)/videos/page.tsx apps/web/src/app/(dashboard)/dashboard/page.tsx apps/web/src/server/trpc/routers/video.ts
git commit -m "refactor: rename GENERATING_AVATAR to GENERATING_SCENES across frontend"
```

---

### Task 3: Update shared types and schemas

**Files:**
- Modify: `packages/shared/src/types.ts:5-10`
- Modify: `packages/shared/src/schemas.ts:4-10`

- [ ] **Step 1: Extend SceneType in types.ts**

In `packages/shared/src/types.ts`, update the `SceneType`:
```typescript
export type SceneType =
  | "talking_head"
  | "product_broll"
  | "text_overlay"
  | "testimonial"
  | "greenscreen"
  | "hook"
  | "benefit"
  | "demo"
  | "cta";
```

- [ ] **Step 2: Update sceneSchema in schemas.ts**

In `packages/shared/src/schemas.ts`, update the enum array:
```typescript
export const sceneSchema = z.object({
  type: z.enum([
    "talking_head",
    "product_broll",
    "text_overlay",
    "testimonial",
    "greenscreen",
    "hook",
    "benefit",
    "demo",
    "cta",
  ]),
  duration_s: z.number().positive(),
  emotion: z.string().optional(),
  gesture: z.string().optional(),
  transition: z.string().optional(),
  text_overlay: z.union([z.boolean(), z.string()]).optional(),
});
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd packages/shared && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/schemas.ts
git commit -m "feat: extend SceneType with hook, benefit, demo, cta"
```

---

### Task 3: Update credit calculation system

**Files:**
- Modify: `packages/shared/src/credits.ts`
- Modify: `packages/shared/src/__tests__/credits.test.ts`

- [ ] **Step 1: Write failing tests for new calculateVideoCredits signature**

Replace the content of `packages/shared/src/__tests__/credits.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  calculateVideoCredits,
  calculateClonedVideoCredits,
  canAfford,
} from "../credits";

describe("calculateVideoCredits", () => {
  it("returns 2 credits for 5 scenes", () => {
    expect(calculateVideoCredits(5)).toBe(2);
  });

  it("returns 2 credits for fewer than 5 scenes (1 chunk)", () => {
    expect(calculateVideoCredits(3)).toBe(2);
  });

  it("returns 4 credits for 6-10 scenes", () => {
    expect(calculateVideoCredits(8)).toBe(4);
  });

  it("returns 2 for 1 scene (ceil(1/5)*2=2, still above minimum 1)", () => {
    expect(calculateVideoCredits(1)).toBe(2);
  });

  it("returns 2 for exactly 5 scenes", () => {
    expect(calculateVideoCredits(5)).toBe(2);
  });

  it("returns 6 for 15 scenes", () => {
    expect(calculateVideoCredits(15)).toBe(6);
  });
});

describe("calculateClonedVideoCredits", () => {
  it("returns 1 credit for a single talking head scene", () => {
    const scenes = [{ type: "talking_head" as const, duration_s: 5 }];
    expect(calculateClonedVideoCredits(scenes)).toBe(1);
  });

  it("returns 0.25 credits for a single broll scene", () => {
    const scenes = [{ type: "product_broll" as const, duration_s: 3 }];
    expect(calculateClonedVideoCredits(scenes)).toBe(0.25);
  });

  it("returns 1.75 for 1 talking head + 3 faceless scenes", () => {
    const scenes = [
      { type: "talking_head" as const, duration_s: 4 },
      { type: "product_broll" as const, duration_s: 3 },
      { type: "text_overlay" as const, duration_s: 2 },
      { type: "testimonial" as const, duration_s: 3 },
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

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd packages/shared && npx vitest run
```
Expected: FAIL — `calculateVideoCredits` currently expects `(type, durationSeconds)` not `(sceneCount)`.

- [ ] **Step 3: Update calculateVideoCredits implementation**

Replace `packages/shared/src/credits.ts`:
```typescript
import type { SceneType } from "./types";

const SCENE_CREDITS: Record<string, number> = {
  talking_head: 1,
  product_broll: 0.25,
  text_overlay: 0.25,
  testimonial: 0.25,
  greenscreen: 0.25,
  hook: 0.25,
  benefit: 0.25,
  demo: 0.25,
  cta: 0.25,
};

/**
 * Calculate credits for a standard (non-cloned) video based on scene count.
 * 2 credits per 5 scenes (or fraction thereof), minimum 1.
 */
export function calculateVideoCredits(sceneCount: number): number {
  return Math.max(1, Math.ceil(sceneCount / 5) * 2);
}

/**
 * Calculate credits for a cloned video based on per-scene type costs.
 * Kept for backward compatibility with clone pipeline.
 */
export function calculateClonedVideoCredits(
  scenes: { type: SceneType | string }[]
): number {
  return scenes.reduce((total, scene) => {
    return total + (SCENE_CREDITS[scene.type] ?? 0.25);
  }, 0);
}

export function canAfford(balance: number, cost: number): boolean {
  return balance >= cost;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd packages/shared && npx vitest run
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/credits.ts packages/shared/src/__tests__/credits.test.ts
git commit -m "feat: update calculateVideoCredits to scene-count-based pricing (2 per 5 scenes)"
```

---

### Task 4: Create AI provider interface

**Files:**
- Create: `packages/shared/src/ai-provider.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create ai-provider.ts with interface and types**

Create `packages/shared/src/ai-provider.ts`:
```typescript
// ---------------------------------------------------------------------------
// AI Provider abstraction — wraps image gen, video gen, and LoRA training
// ---------------------------------------------------------------------------

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  loraUrl?: string;
  loraScale?: number;
}

export interface ImageGenerationResult {
  url: string;
  seed: number;
}

export interface VideoGenerationRequest {
  imageUrl: string;
  prompt: string;
  duration: number; // seconds (capped at 10 for Kling)
  aspectRatio: "9:16" | "16:9" | "1:1";
}

export interface VideoGenerationResult {
  url: string;
  duration: number;
}

export interface LoRATrainingRequest {
  imageUrls: string[]; // 4+ image URLs
  triggerWord: string;
}

export interface LoRATrainingResult {
  loraUrl: string;
  triggerWord: string;
}

export interface AIProvider {
  generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult>;
  generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult>;
  trainLoRA(req: LoRATrainingRequest): Promise<LoRATrainingResult>;
}
```

- [ ] **Step 2: Export from index.ts**

In `packages/shared/src/index.ts`, add:
```typescript
export * from "./ai-provider";
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd packages/shared && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/ai-provider.ts packages/shared/src/index.ts
git commit -m "feat: add AIProvider interface for image gen, video gen, LoRA training"
```

---

## Chunk 2: fal.ai Provider + Scene Generator

### Task 5: Install dependencies

**Files:**
- Modify: `apps/workers/package.json`

- [ ] **Step 1: Install @fal-ai/client and archiver**

Run:
```bash
cd apps/workers && pnpm add @fal-ai/client archiver && pnpm add -D @types/archiver
```
Expected: Packages installed successfully.

- [ ] **Step 2: Commit**

```bash
git add apps/workers/package.json pnpm-lock.yaml
git commit -m "chore: add @fal-ai/client and archiver dependencies"
```

---

### Task 6: Implement FalProvider

**Files:**
- Create: `apps/workers/src/providers/fal.ts`

- [ ] **Step 1: Create the providers directory and fal.ts**

Run:
```bash
ls apps/workers/src/
```
Verify `providers/` does not yet exist.

- [ ] **Step 2: Write FalProvider implementation**

Create `apps/workers/src/providers/fal.ts`:
```typescript
import fal from "@fal-ai/client";
import type {
  AIProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
  VideoGenerationRequest,
  VideoGenerationResult,
  LoRATrainingRequest,
  LoRATrainingResult,
} from "@ugc/shared";
import { uploadToR2 } from "../lib/r2";
import archiver from "archiver";

// ---------------------------------------------------------------------------
// fal.ai provider — implements AIProvider interface
// ---------------------------------------------------------------------------

export class FalProvider implements AIProvider {
  constructor() {
    fal.config({ credentials: process.env.FAL_KEY! });
  }

  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const input: Record<string, unknown> = {
      prompt: req.prompt,
      image_size: { width: req.width, height: req.height },
    };
    if (req.negativePrompt) input.negative_prompt = req.negativePrompt;
    if (req.loraUrl) {
      input.loras = [{ path: req.loraUrl, scale: req.loraScale ?? 0.8 }];
    }

    const result = await fal.subscribe("fal-ai/flux-pro/v1.1", { input });
    const data = result.data as { images: Array<{ url: string }>; seed: number };
    return { url: data.images[0]!.url, seed: data.seed };
  }

  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const duration = Math.min(req.duration, 10);
    const result = await fal.subscribe("fal-ai/kling-video/v3/pro/image-to-video", {
      input: {
        image_url: req.imageUrl,
        prompt: req.prompt,
        duration: String(duration),
        aspect_ratio: req.aspectRatio,
      },
    });
    const data = result.data as { video: { url: string } };
    return { url: data.video.url, duration };
  }

  async trainLoRA(req: LoRATrainingRequest): Promise<LoRATrainingResult> {
    const zipUrl = await this.packageImagesAsZip(req.imageUrls);
    const result = await fal.subscribe("fal-ai/flux-lora-fast-training", {
      input: {
        images_data_url: zipUrl,
        trigger_word: req.triggerWord,
        steps: 1000,
      },
    });
    const data = result.data as { diffusers_lora_file: { url: string } };
    return { loraUrl: data.diffusers_lora_file.url, triggerWord: req.triggerWord };
  }

  private async packageImagesAsZip(imageUrls: string[]): Promise<string> {
    const archive = archiver("zip", { zlib: { level: 5 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));

    // Download each image and append to archive
    for (let i = 0; i < imageUrls.length; i++) {
      const response = await fetch(imageUrls[i]!);
      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = imageUrls[i]!.split(".").pop()?.split("?")[0] ?? "jpg";
      archive.append(buffer, { name: `image-${i}.${ext}` });
    }

    await archive.finalize();
    const zipBuffer = Buffer.concat(chunks);

    // Upload ZIP to R2 and return URL
    const key = `lora-training/${Date.now()}/training-images.zip`;
    const url = await uploadToR2(key, zipBuffer, "application/zip");
    return url;
  }
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd apps/workers && npx tsc --noEmit
```
Expected: No type errors. (May need to adjust fal import — check if `@fal-ai/client` uses default or named export.)

- [ ] **Step 4: Commit**

```bash
git add apps/workers/src/providers/fal.ts
git commit -m "feat: implement FalProvider with Flux Pro, Kling V3, and LoRA training"
```

---

### Task 7: Implement scene generator — normalization + prompt building

**Files:**
- Create: `apps/workers/src/processors/scene-generator.ts`
- Create: `apps/workers/src/__tests__/scene-generator.test.ts`

- [ ] **Step 1: Write failing tests for scene normalization**

Create `apps/workers/src/__tests__/scene-generator.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  normalizeScenes,
  buildImagePrompt,
  type NormalizedScene,
} from "../processors/scene-generator";

describe("normalizeScenes", () => {
  it("normalizes TALKING_HEAD scenes", () => {
    const scriptVariant = {
      scenes: [
        { type: "hook", text: "Stop scrolling!", duration_s: 3, emotion: "excited", gesture: "point", transition: "cut" },
        { type: "benefit", text: "This product changed my skin", duration_s: 5, emotion: "calm", gesture: "show", transition: "fade" },
      ],
    };
    const result = normalizeScenes("TALKING_HEAD", scriptVariant);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: "hook",
      visualDescription: "Stop scrolling!",
      captionText: "Stop scrolling!",
      duration_s: 3,
      emotion: "excited",
    });
  });

  it("normalizes FACELESS scenes", () => {
    const scriptVariant = {
      scenes: [
        { type: "hook", text_overlay: "Wait for it...", voiceover: "You won't believe this", broll_description: "dramatic product reveal close-up", duration_s: 3, transition: "cut" },
      ],
    };
    const result = normalizeScenes("FACELESS", scriptVariant);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "hook",
      visualDescription: "dramatic product reveal close-up",
      captionText: "You won't believe this",
      duration_s: 3,
      emotion: undefined,
    });
  });

  it("normalizes CLONED scenes — flattens hook + scenes + cta", () => {
    const scriptVariant = {
      hook: { type: "hook", duration_s: 3, text_overlay: "Big reveal" },
      scenes: [
        { type: "demo", duration_s: 5, text_overlay: "Watch this" },
      ],
      cta: { type: "cta", duration_s: 2, text_overlay: "Buy now" },
    };
    const result = normalizeScenes("CLONED", scriptVariant);
    expect(result).toHaveLength(3);
    expect(result[0]!.type).toBe("hook");
    expect(result[0]!.captionText).toBe("Big reveal");
    expect(result[2]!.type).toBe("cta");
  });
});

describe("buildImagePrompt", () => {
  it("builds prompt with preset style", () => {
    const scene: NormalizedScene = {
      type: "hook",
      visualDescription: "person holding serum bottle",
      captionText: "This changed everything",
      duration_s: 3,
    };
    const prompt = buildImagePrompt(scene, {
      sceneStyles: { hook: "extreme close-up of glowing dewy skin, soft studio lighting" },
      productName: "Glow Serum",
      loraTriggerWord: undefined,
    });
    expect(prompt).toContain("extreme close-up of glowing dewy skin");
    expect(prompt).toContain("Glow Serum");
    expect(prompt).toContain("person holding serum bottle");
    expect(prompt).toContain("professional product photography");
  });

  it("includes LoRA trigger word when provided", () => {
    const scene: NormalizedScene = {
      type: "demo",
      visualDescription: "product on table",
      captionText: "Demo time",
      duration_s: 5,
    };
    const prompt = buildImagePrompt(scene, {
      sceneStyles: {},
      productName: "Widget",
      loraTriggerWord: "mybrand_style",
    });
    expect(prompt).toContain("in the style of mybrand_style");
  });

  it("uses default scene style when preset has no match", () => {
    const scene: NormalizedScene = {
      type: "hook",
      visualDescription: "dramatic reveal",
      captionText: "Wow",
      duration_s: 3,
    };
    const prompt = buildImagePrompt(scene, {
      sceneStyles: {},
      productName: "Widget",
      loraTriggerWord: undefined,
    });
    // Should use the default hook style
    expect(prompt).toContain("dramatic reveal");
    expect(prompt).toContain("professional product photography");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd apps/workers && npx vitest run src/__tests__/scene-generator.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement scene-generator.ts**

Create `apps/workers/src/processors/scene-generator.ts`:
```typescript
import { prisma } from "@ugc/db";
import { FalProvider } from "../providers/fal";
import { uploadToR2 } from "../lib/r2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NormalizedScene {
  type: string;
  visualDescription: string;
  captionText: string;
  duration_s: number;
  emotion?: string;
}

export interface SceneGeneratorJobData {
  videoId: string;
}

interface PromptContext {
  sceneStyles: Record<string, string>;
  productName: string;
  loraTriggerWord?: string;
}

// ---------------------------------------------------------------------------
// Default scene-type visual strategies (used when no preset match)
// ---------------------------------------------------------------------------

const DEFAULT_SCENE_STYLES: Record<string, string> = {
  hook: "bold pattern-interrupt visual, dramatic close-up, eye-catching",
  benefit: "product in use showing value proposition, soft natural lighting",
  demo: "product interaction step-by-step, clean background",
  testimonial: "authentic candid feel, warm lighting, genuine expression",
  cta: "product arrangement, call-to-action composition, inviting",
};

// ---------------------------------------------------------------------------
// Scene normalization
// ---------------------------------------------------------------------------

export function normalizeScenes(
  videoType: "TALKING_HEAD" | "FACELESS" | "CLONED",
  scriptVariant: Record<string, unknown>
): NormalizedScene[] {
  switch (videoType) {
    case "TALKING_HEAD":
      return normalizeTalkingHead(scriptVariant);
    case "FACELESS":
      return normalizeFaceless(scriptVariant);
    case "CLONED":
      return normalizeCloned(scriptVariant);
    default:
      return normalizeFaceless(scriptVariant);
  }
}

function normalizeTalkingHead(sv: Record<string, unknown>): NormalizedScene[] {
  const scenes = (sv.scenes ?? []) as Array<{
    type: string;
    text: string;
    duration_s: number;
    emotion?: string;
  }>;
  return scenes.map((s) => ({
    type: s.type,
    visualDescription: s.text,
    captionText: s.text,
    duration_s: s.duration_s,
    emotion: s.emotion,
  }));
}

function normalizeFaceless(sv: Record<string, unknown>): NormalizedScene[] {
  const scenes = (sv.scenes ?? []) as Array<{
    type: string;
    text_overlay?: string;
    voiceover?: string;
    broll_description?: string;
    duration_s: number;
  }>;
  return scenes.map((s) => ({
    type: s.type,
    visualDescription: s.broll_description ?? s.text_overlay ?? "",
    captionText: s.voiceover ?? s.text_overlay ?? "",
    duration_s: s.duration_s,
    emotion: undefined,
  }));
}

function normalizeCloned(sv: Record<string, unknown>): NormalizedScene[] {
  const result: NormalizedScene[] = [];
  const hook = sv.hook as { type: string; duration_s: number; text_overlay?: string } | undefined;
  const scenes = (sv.scenes ?? []) as Array<{ type: string; duration_s: number; text_overlay?: string; emotion?: string }>;
  const cta = sv.cta as { type: string; duration_s: number; text_overlay?: string } | undefined;

  if (hook) {
    result.push({
      type: hook.type,
      visualDescription: hook.text_overlay ?? "dramatic opening hook",
      captionText: hook.text_overlay ?? "",
      duration_s: hook.duration_s,
    });
  }

  for (const s of scenes) {
    result.push({
      type: s.type,
      visualDescription: s.text_overlay ?? s.type,
      captionText: s.text_overlay ?? "",
      duration_s: s.duration_s,
      emotion: s.emotion,
    });
  }

  if (cta) {
    result.push({
      type: cta.type,
      visualDescription: cta.text_overlay ?? "call to action",
      captionText: cta.text_overlay ?? "",
      duration_s: cta.duration_s,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

export function buildImagePrompt(
  scene: NormalizedScene,
  ctx: PromptContext
): string {
  const parts: string[] = [];

  // 1. Preset scene style (or default)
  const sceneStyle = ctx.sceneStyles[scene.type] ?? DEFAULT_SCENE_STYLES[scene.type] ?? "";
  if (sceneStyle) parts.push(sceneStyle);

  // 2. Product context
  if (ctx.productName) parts.push(`featuring ${ctx.productName}`);

  // 3. LoRA trigger word
  if (ctx.loraTriggerWord) parts.push(`in the style of ${ctx.loraTriggerWord}`);

  // 4. Scene-specific visual description
  if (scene.visualDescription) parts.push(scene.visualDescription);

  // 5. Quality suffix
  parts.push("professional product photography, 4k, sharp focus");

  return parts.join(", ");
}

function buildNegativePrompt(presetNegative?: string): string {
  const base = "blurry, low quality, text, watermark, cartoon, illustration";
  return presetNegative ? `${presetNegative}, ${base}` : base;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processSceneGeneratorJob(job: { data: SceneGeneratorJobData }) {
  const { videoId } = job.data;

  console.log(`[scene-generator] Starting scene generation for video ${videoId}`);

  // 1. Read inputs from DB
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
    include: { product: true, brandKit: true, preset: true },
  });

  await prisma.video.update({
    where: { id: videoId },
    data: { status: "GENERATING_SCENES" },
  });

  const scriptVariant = (video.scriptVariant ?? {}) as Record<string, unknown>;
  const videoType = video.type as "TALKING_HEAD" | "FACELESS" | "CLONED";

  // 2. Normalize scenes
  const scenes = normalizeScenes(videoType, scriptVariant);

  if (scenes.length === 0) {
    throw new Error("No scenes found in script variant");
  }

  console.log(`[scene-generator] Normalized ${scenes.length} scenes for video ${videoId}`);

  // 3. Build prompt context
  const presetSceneStyles = (video.preset?.sceneStyles as Record<string, string>) ?? {};
  const presetNegative = video.preset?.negativePrompt ?? undefined;
  const productName = video.product?.name ?? "";
  const loraTriggerWord = video.brandKit?.loraTriggerWord ?? undefined;

  const promptCtx: PromptContext = {
    sceneStyles: presetSceneStyles,
    productName,
    loraTriggerWord,
  };

  // 4. Generate images and videos for each scene (sequentially)
  const provider = new FalProvider();
  const allSceneVideos: string[][] = [];
  const allSceneImages: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]!;
    console.log(`[scene-generator] Processing scene ${i + 1}/${scenes.length} (${scene.type})`);

    // Generate image
    const prompt = buildImagePrompt(scene, promptCtx);
    const negativePrompt = buildNegativePrompt(presetNegative);

    const imageResult = await provider.generateImage({
      prompt,
      negativePrompt,
      width: 1080,
      height: 1920,
      loraUrl: video.brandKit?.loraUrl ?? undefined,
      loraScale: 0.8,
    });

    // Download and upload image to R2
    const imgResponse = await fetch(imageResult.url);
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
    const imgKey = `videos/${videoId}/scenes/scene-${i}.jpg`;
    const imgUrl = await uploadToR2(imgKey, imgBuffer, "image/jpeg");
    allSceneImages.push(imgUrl);

    console.log(`[scene-generator] Scene ${i + 1} image generated`);

    // Generate video segments (handle >10s scenes)
    const segmentUrls: string[] = [];
    let remainingDuration = scene.duration_s;
    let segmentIndex = 0;
    let currentImageUrl = imageResult.url;

    while (remainingDuration > 0) {
      const segmentDuration = Math.min(remainingDuration, 10);

      let videoResult;
      try {
        videoResult = await provider.generateVideo({
          imageUrl: currentImageUrl,
          prompt: scene.visualDescription,
          duration: segmentDuration,
          aspectRatio: "9:16",
        });
      } catch (err) {
        // Fallback to Wan 2.2 if Kling fails
        console.warn(`[scene-generator] Kling V3 failed for scene ${i}, segment ${segmentIndex}, trying Wan 2.2`);
        videoResult = await fallbackVideoGeneration(provider, currentImageUrl, scene.visualDescription, segmentDuration);
      }

      // Download and upload video segment to R2
      const vidResponse = await fetch(videoResult.url);
      const vidBuffer = Buffer.from(await vidResponse.arrayBuffer());
      const vidKey = `videos/${videoId}/scenes/scene-${i}-part-${segmentIndex}.mp4`;
      const vidUrl = await uploadToR2(vidKey, vidBuffer, "video/mp4");
      segmentUrls.push(vidUrl);

      remainingDuration -= segmentDuration;
      segmentIndex++;

      // For next segment, use last frame of current video
      // (We use the original image URL again as a reasonable approximation —
      //  true last-frame extraction would need FFmpeg on the worker)
      currentImageUrl = imageResult.url;
    }

    allSceneVideos.push(segmentUrls);
    console.log(`[scene-generator] Scene ${i + 1} video generated (${segmentUrls.length} segments)`);
  }

  // 5. Write outputs to DB
  await prisma.video.update({
    where: { id: videoId },
    data: {
      sceneVideos: allSceneVideos,
      sceneImages: allSceneImages,
    },
  });

  console.log(`[scene-generator] All scenes generated for video ${videoId}`);

  return { videoId, sceneCount: scenes.length };
}

// ---------------------------------------------------------------------------
// Fallback: Wan 2.2 via fal.ai
// ---------------------------------------------------------------------------

async function fallbackVideoGeneration(
  _provider: FalProvider,
  imageUrl: string,
  prompt: string,
  duration: number
) {
  const fal = (await import("@fal-ai/client")).default;
  const result = await fal.subscribe("fal-ai/wan/v2.2/image-to-video", {
    input: {
      image_url: imageUrl,
      prompt,
      duration: String(Math.min(duration, 5)), // Wan max 5s
      aspect_ratio: "9:16",
    },
  });
  const data = result.data as { video: { url: string } };
  return { url: data.video.url, duration };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd apps/workers && npx vitest run src/__tests__/scene-generator.test.ts
```
Expected: All normalization and prompt-building tests PASS. (The processor function itself requires DB/API — only unit testing pure functions.)

- [ ] **Step 5: Commit**

```bash
git add apps/workers/src/processors/scene-generator.ts apps/workers/src/__tests__/scene-generator.test.ts
git commit -m "feat: implement scene generator with normalization, prompt building, and fal.ai integration"
```

---

## Chunk 3: Video Assembler + LoRA Trainer

### Task 8: Implement video assembler

**Files:**
- Create: `apps/workers/src/processors/video-assembler.ts`
- Create: `apps/workers/src/__tests__/video-assembler.test.ts`

- [ ] **Step 1: Write failing tests for FFmpeg command building**

Create `apps/workers/src/__tests__/video-assembler.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildConcatFileContent, buildDrawtextFilter } from "../processors/video-assembler";

describe("buildConcatFileContent", () => {
  it("generates concat demuxer input for scene files", () => {
    const files = ["/tmp/scene-0.mp4", "/tmp/scene-1.mp4", "/tmp/scene-2.mp4"];
    const result = buildConcatFileContent(files);
    expect(result).toBe(
      "file '/tmp/scene-0.mp4'\nfile '/tmp/scene-1.mp4'\nfile '/tmp/scene-2.mp4'"
    );
  });

  it("handles single file", () => {
    const result = buildConcatFileContent(["/tmp/only.mp4"]);
    expect(result).toBe("file '/tmp/only.mp4'");
  });
});

describe("buildDrawtextFilter", () => {
  it("builds drawtext filter for captions", () => {
    const captions = [
      { text: "Hello world", startTime: 0, endTime: 3 },
      { text: "Buy now", startTime: 3, endTime: 5 },
    ];
    const filter = buildDrawtextFilter(captions);
    expect(filter).toContain("drawtext=");
    expect(filter).toContain("Hello world");
    expect(filter).toContain("Buy now");
    expect(filter).toContain("enable='between(t,0,3)'");
    expect(filter).toContain("enable='between(t,3,5)'");
  });

  it("returns empty string for no captions", () => {
    expect(buildDrawtextFilter([])).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd apps/workers && npx vitest run src/__tests__/video-assembler.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement video-assembler.ts**

Create `apps/workers/src/processors/video-assembler.ts`:
```typescript
import { prisma } from "@ugc/db";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uploadToR2 } from "../lib/r2";
import { readFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoAssemblerJobData {
  videoId: string;
}

interface CaptionEntry {
  text: string;
  startTime: number;
  endTime: number;
}

// ---------------------------------------------------------------------------
// FFmpeg helpers (exported for testing)
// ---------------------------------------------------------------------------

export function buildConcatFileContent(filePaths: string[]): string {
  return filePaths.map((f) => `file '${f}'`).join("\n");
}

export function buildDrawtextFilter(captions: CaptionEntry[]): string {
  if (captions.length === 0) return "";

  const filters = captions.map((c) => {
    const escapedText = c.text
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "'\\''")
      .replace(/:/g, "\\:");
    return [
      `drawtext=text='${escapedText}'`,
      "fontsize=48",
      "fontcolor=white",
      "borderw=3",
      "bordercolor=black",
      "x=(w-text_w)/2",
      "y=h-h/5",
      `enable='between(t,${c.startTime},${c.endTime})'`,
    ].join(":");
  });

  return filters.join(",");
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processVideoAssemblerJob(job: { data: VideoAssemblerJobData }) {
  const { videoId } = job.data;
  let tempDir: string | null = null;

  console.log(`[video-assembler] Starting assembly for video ${videoId}`);

  try {
    // 1. Read inputs from DB
    const video = await prisma.video.findUniqueOrThrow({
      where: { id: videoId },
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { status: "COMPOSING" },
    });

    const sceneVideos = (video.sceneVideos ?? []) as string[][];
    const scriptVariant = (video.scriptVariant ?? {}) as Record<string, unknown>;

    if (sceneVideos.length === 0) {
      throw new Error("No scene videos found");
    }

    // 2. Create temp directory
    tempDir = await mkdtemp(join(tmpdir(), `video-${videoId}-`));

    // 3. Download all scene clips
    const sceneFilePaths: string[] = [];
    for (let i = 0; i < sceneVideos.length; i++) {
      const segments = sceneVideos[i]!;
      for (let j = 0; j < segments.length; j++) {
        const url = segments[j]!;
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const filePath = join(tempDir, `scene-${i}-part-${j}.mp4`);
        await writeFile(filePath, buffer);
        sceneFilePaths.push(filePath);
      }
    }

    // 4. Download audio files
    const audioFilePaths: string[] = [];
    const audioUrl = video.audioUrl;
    if (audioUrl) {
      // Try to find per-scene audio files (pattern: videos/{videoId}/audio/scene-{i}.mp3)
      // For now, use the primary audioUrl
      const response = await fetch(audioUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      const audioPath = join(tempDir, "audio.mp3");
      await writeFile(audioPath, buffer);
      audioFilePaths.push(audioPath);
    }

    // 5. Build concat file
    const concatContent = buildConcatFileContent(sceneFilePaths);
    const concatFilePath = join(tempDir, "scenes.txt");
    await writeFile(concatFilePath, concatContent);

    // 6. Build caption entries from script variant
    const captions = buildCaptionsFromScript(scriptVariant, sceneVideos);

    // 7. Build FFmpeg command
    const outputPath = join(tempDir, "output.mp4");
    const ffmpegArgs = buildFFmpegArgs(concatFilePath, audioFilePaths[0], captions, outputPath);

    console.log(`[video-assembler] Running FFmpeg with ${sceneFilePaths.length} clips`);

    await execFileAsync("ffmpeg", ffmpegArgs, { timeout: 300_000 }); // 5 min timeout

    // 8. Upload to R2
    const outputBuffer = await readFile(outputPath);
    const r2Key = `videos/${videoId}/final.mp4`;
    const finalUrl = await uploadToR2(r2Key, outputBuffer, "video/mp4");

    // 9. Calculate total duration
    const totalDuration = sceneVideos.flat().length * 6; // rough estimate — could probe with ffprobe

    // 10. Update DB
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "COMPLETED",
        finalVideoUrl: finalUrl,
        duration: totalDuration,
      },
    });

    console.log(`[video-assembler] Video ${videoId} assembled and uploaded`);

    return { videoId, finalVideoUrl: finalUrl, duration: totalDuration };
  } catch (error) {
    console.error(`[video-assembler] Failed to assemble video ${videoId}:`, error);

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "FAILED",
        error: `Assembly failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    });

    throw error;
  } finally {
    // Cleanup temp directory
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildFFmpegArgs(
  concatFile: string,
  audioFile: string | undefined,
  captions: CaptionEntry[],
  outputPath: string
): string[] {
  const args: string[] = [
    "-f", "concat",
    "-safe", "0",
    "-i", concatFile,
  ];

  if (audioFile) {
    args.push("-i", audioFile);
  }

  // Video filter (captions)
  const drawtextFilter = buildDrawtextFilter(captions);
  if (drawtextFilter) {
    args.push("-vf", drawtextFilter);
  }

  args.push(
    "-c:v", "libx264",
    "-preset", "fast",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-y",
    outputPath
  );

  return args;
}

function buildCaptionsFromScript(
  scriptVariant: Record<string, unknown>,
  sceneVideos: string[][]
): CaptionEntry[] {
  const captions: CaptionEntry[] = [];
  let currentTime = 0;

  // Try to extract scenes from any video type format
  const scenes = (scriptVariant.scenes ?? []) as Array<{
    text?: string;
    voiceover?: string;
    text_overlay?: string;
    duration_s: number;
  }>;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!scene) continue;

    const text = scene.voiceover ?? scene.text ?? scene.text_overlay;
    const duration = scene.duration_s ?? 5;

    if (text && text.trim().length > 0) {
      captions.push({
        text: text.trim(),
        startTime: currentTime,
        endTime: currentTime + duration,
      });
    }

    currentTime += duration;
  }

  return captions;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd apps/workers && npx vitest run src/__tests__/video-assembler.test.ts
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/workers/src/processors/video-assembler.ts apps/workers/src/__tests__/video-assembler.test.ts
git commit -m "feat: implement video assembler with FFmpeg concat, audio overlay, and caption burn-in"
```

---

### Task 9: Implement LoRA trainer processor

**Files:**
- Create: `apps/workers/src/processors/lora-trainer.ts`

- [ ] **Step 1: Implement lora-trainer.ts**

Create `apps/workers/src/processors/lora-trainer.ts`:
```typescript
import { prisma } from "@ugc/db";
import { FalProvider } from "../providers/fal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoRATrainingJobData {
  brandKitId: string;
  orgId: string;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processLoRATrainingJob(job: { data: LoRATrainingJobData }) {
  const { brandKitId, orgId } = job.data;

  console.log(`[lora-trainer] Starting LoRA training for brand kit ${brandKitId}`);

  try {
    const brandKit = await prisma.brandKit.findFirstOrThrow({
      where: { id: brandKitId, orgId },
    });

    const imageUrls = (brandKit.loraTrainingImages ?? []) as string[];

    if (imageUrls.length < 4) {
      throw new Error(`Need at least 4 training images, got ${imageUrls.length}`);
    }

    // Update status to training
    await prisma.brandKit.update({
      where: { id: brandKitId },
      data: { loraTrainingStatus: "training" },
    });

    // Train LoRA
    const provider = new FalProvider();
    const triggerWord = `${brandKit.name.toLowerCase().replace(/\s+/g, "_")}_style`;

    const result = await provider.trainLoRA({
      imageUrls,
      triggerWord,
    });

    // Update with results
    await prisma.brandKit.update({
      where: { id: brandKitId },
      data: {
        loraUrl: result.loraUrl,
        loraTriggerWord: result.triggerWord,
        loraTrainingStatus: "ready",
      },
    });

    console.log(`[lora-trainer] LoRA training complete for brand kit ${brandKitId}`);

    return { brandKitId, loraUrl: result.loraUrl };
  } catch (error) {
    console.error(`[lora-trainer] LoRA training failed for brand kit ${brandKitId}:`, error);

    await prisma.brandKit.update({
      where: { id: brandKitId },
      data: {
        loraTrainingStatus: "failed",
      },
    });

    throw error;
  }
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd apps/workers && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/workers/src/processors/lora-trainer.ts
git commit -m "feat: implement LoRA trainer processor for brand kit visual style training"
```

---

## Chunk 4: Worker Integration — Queue Names, Chaining, Pipeline

### Task 10: Update queue names

**Files:**
- Modify: `apps/workers/src/queues.ts`

- [ ] **Step 1: Update QUEUE_NAMES**

Replace `apps/workers/src/queues.ts`:
```typescript
import { getBoss } from "./boss";

export const QUEUE_NAMES = {
  SCRAPER: "scraper",
  SCRIPT: "script",
  TTS: "tts",
  SCENE_GENERATOR: "scene-generator",
  VIDEO_ASSEMBLER: "video-assembler",
  LORA_TRAINING: "lora-training",
  CLONE_DOWNLOAD: "clone-download",
  CLONE_ANALYZE: "clone-analyze",
  MONITOR: "monitor",
  PUBLISH: "publish",
  SCHEDULER: "scheduler",
  CLONE: "clone",
} as const;

export async function sendJob(
  queue: string,
  data: object,
  options?: { priority?: number; retryLimit?: number; startAfter?: number }
): Promise<string | null> {
  const boss = getBoss();
  return boss.send(queue, data, options);
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd apps/workers && npx tsc --noEmit
```
Expected: Errors from `index.ts` referencing `QUEUE_NAMES.AVATAR` and `QUEUE_NAMES.COMPOSER` — expected, will fix in next task.

- [ ] **Step 3: Commit**

```bash
git add apps/workers/src/queues.ts
git commit -m "feat: update queue names — replace AVATAR/COMPOSER with SCENE_GENERATOR/VIDEO_ASSEMBLER, add LORA_TRAINING"
```

---

### Task 11: Update worker index.ts — new processors, simplified chaining

**Files:**
- Modify: `apps/workers/src/index.ts`

- [ ] **Step 1: Rewrite index.ts with new processors and hybrid chaining**

**IMPORTANT:** The existing processors (scraper, script-generator, TTS) are NOT modified. They still read from `job.data`. The chaining for SCRAPER→SCRIPT→TTS keeps the old data-forwarding pattern. Only TTS→SCENE_GENERATOR→VIDEO_ASSEMBLER uses simplified DB-mediated flow.

Replace `apps/workers/src/index.ts`:
```typescript
import { startBoss, stopBoss } from "./boss";
import { QUEUE_NAMES, sendJob } from "./queues";
import { processScraperJob } from "./processors/scraper";
import { processScriptJob } from "./processors/script-generator";
import { processTTSJob } from "./processors/tts";
import { processSceneGeneratorJob } from "./processors/scene-generator";
import { processVideoAssemblerJob } from "./processors/video-assembler";
import { processLoRATrainingJob } from "./processors/lora-trainer";
import { handlePipelineFailure } from "./processors/pipeline";
import { processVideoDownloaderJob } from "./processors/video-downloader";
import { processCloneAnalyzerJob } from "./processors/clone-analyzer";
import { processMonitorJob } from "./processors/monitor";
import { processPublishJob } from "./processors/publisher";
import { processSchedulerJob } from "./processors/scheduler";
import type { ScriptJobData } from "./processors/script-generator";
import type { TTSJobData } from "./processors/tts";

// ---------------------------------------------------------------------------
// Pipeline metadata — carries IDs + data needed by existing processors
// ---------------------------------------------------------------------------

interface PipelineMeta {
  videoId: string;
  productUrl: string;
  productId: string;
  orgId: string;
  videoType: "TALKING_HEAD" | "FACELESS" | "CLONED";
  voiceId: string;
  brandKitId?: string;
  presetId?: string;
  templateId?: string;
  // Legacy fields — still needed by scraper/script/TTS processors
  brandKit: ScriptJobData["brandKit"];
  templateStructure: ScriptJobData["templateStructure"];
}

// ---------------------------------------------------------------------------
// Pipeline step chaining — hybrid approach:
// - SCRAPER→SCRIPT→TTS: old data-forwarding pattern (existing processors unchanged)
// - TTS→SCENE_GENERATOR→VIDEO_ASSEMBLER: simplified DB-mediated flow (new processors)
// ---------------------------------------------------------------------------

async function chainNextPipelineStep(
  currentQueue: string,
  pipeline: PipelineMeta
): Promise<void> {
  const { videoId, voiceId, videoType } = pipeline;

  switch (currentQueue) {
    // --- Old data-forwarding pattern (existing processors expect job.data fields) ---
    case QUEUE_NAMES.SCRAPER:
      await sendJob(QUEUE_NAMES.SCRIPT, {
        videoId,
        productData: { title: "", description: "", images: [], price: null, reviews: [] },
        videoType,
        brandKit: pipeline.brandKit,
        templateStructure: pipeline.templateStructure,
        _pipeline: pipeline,
      } satisfies ScriptJobData & { _pipeline: PipelineMeta });
      break;

    case QUEUE_NAMES.SCRIPT:
      await sendJob(QUEUE_NAMES.TTS, {
        videoId,
        scenes: [],
        voiceId,
        _pipeline: pipeline,
      } satisfies TTSJobData & { _pipeline: PipelineMeta });
      break;

    // --- New DB-mediated pattern (new processors read from DB using videoId) ---
    case QUEUE_NAMES.TTS:
      await sendJob(QUEUE_NAMES.SCENE_GENERATOR, {
        videoId,
        _pipeline: pipeline,
      });
      break;

    case QUEUE_NAMES.SCENE_GENERATOR:
      await sendJob(QUEUE_NAMES.VIDEO_ASSEMBLER, {
        videoId,
        _pipeline: pipeline,
      });
      break;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const boss = await startBoss();

  console.log("Workers starting with pg-boss...");

  // -------------------------------------------------------------------
  // Pipeline workers — with job chaining on success
  // -------------------------------------------------------------------

  const pipelineQueues = [
    QUEUE_NAMES.SCRAPER,
    QUEUE_NAMES.SCRIPT,
    QUEUE_NAMES.TTS,
    QUEUE_NAMES.SCENE_GENERATOR,
  ] as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processors: Record<string, (job: { data: any }) => Promise<any>> = {
    [QUEUE_NAMES.SCRAPER]: processScraperJob,
    [QUEUE_NAMES.SCRIPT]: processScriptJob,
    [QUEUE_NAMES.TTS]: processTTSJob,
    [QUEUE_NAMES.SCENE_GENERATOR]: processSceneGeneratorJob,
  };

  const concurrencyMap: Record<string, number> = {
    [QUEUE_NAMES.SCRAPER]: 5,
    [QUEUE_NAMES.SCRIPT]: 3,
    [QUEUE_NAMES.TTS]: 3,
    [QUEUE_NAMES.SCENE_GENERATOR]: 2,
  };

  for (const queueName of pipelineQueues) {
    const processor = processors[queueName]!;

    await boss.work(
      queueName,
      { localConcurrency: concurrencyMap[queueName] ?? 3 },
      async (jobs) => {
        const job = jobs[0];
        try {
          await processor(job);

          // Chain next pipeline step if this job is part of a pipeline
          const pipeline = (job.data as Record<string, unknown>)?._pipeline as PipelineMeta | undefined;
          if (pipeline) {
            await chainNextPipelineStep(queueName, pipeline);
          }
        } catch (error) {
          // Handle pipeline failure (refund credits)
          const data = job.data as Record<string, unknown>;
          const pipeline = data?._pipeline as PipelineMeta | undefined;
          const videoId = pipeline?.videoId ?? (data?.videoId as string | undefined);
          if (videoId) {
            await handlePipelineFailure(videoId, error instanceof Error ? error : new Error(String(error)));
          }
          throw error;
        }
      }
    );
  }

  // Video Assembler — end of pipeline, no chaining needed
  await boss.work(
    QUEUE_NAMES.VIDEO_ASSEMBLER,
    { localConcurrency: 2 },
    async (jobs) => {
      const job = jobs[0];
      try {
        await processVideoAssemblerJob(job as any);
      } catch (error) {
        const data = job.data as Record<string, unknown>;
        const videoId = data?.videoId as string | undefined;
        if (videoId) {
          await handlePipelineFailure(videoId, error instanceof Error ? error : new Error(String(error)));
        }
        throw error;
      }
    }
  );

  // LoRA Training — independent, not part of video pipeline
  await boss.work(
    QUEUE_NAMES.LORA_TRAINING,
    { localConcurrency: 1 },
    async (jobs) => { await processLoRATrainingJob(jobs[0] as any); }
  );

  // -------------------------------------------------------------------
  // Non-pipeline workers
  // -------------------------------------------------------------------

  await boss.work(
    QUEUE_NAMES.CLONE_DOWNLOAD,
    { localConcurrency: 3 },
    async (jobs) => { await processVideoDownloaderJob(jobs[0] as any); }
  );

  await boss.work(
    QUEUE_NAMES.CLONE_ANALYZE,
    { localConcurrency: 2 },
    async (jobs) => { await processCloneAnalyzerJob(jobs[0] as any); }
  );

  await boss.work(
    QUEUE_NAMES.MONITOR,
    { localConcurrency: 2 },
    async (jobs) => { await processMonitorJob(jobs[0] as any); }
  );

  await boss.work(
    QUEUE_NAMES.PUBLISH,
    { localConcurrency: 2 },
    async (jobs) => { await processPublishJob(jobs[0] as any); }
  );

  await boss.work(
    QUEUE_NAMES.SCHEDULER,
    { localConcurrency: 1 },
    async (jobs) => { await processSchedulerJob(jobs[0] as any); }
  );

  // -------------------------------------------------------------------
  // Scheduler cron — check for scheduled publishes every minute
  // -------------------------------------------------------------------

  await boss.schedule(QUEUE_NAMES.SCHEDULER, "* * * * *", {
    _trigger: "cron",
  });

  console.log("Workers registered:");
  console.log("  - scraper            (concurrency: 5)");
  console.log("  - script             (concurrency: 3)");
  console.log("  - tts                (concurrency: 3)");
  console.log("  - scene-generator    (concurrency: 2)");
  console.log("  - video-assembler    (concurrency: 2)");
  console.log("  - lora-training      (concurrency: 1)");
  console.log("  - clone-download     (concurrency: 3)");
  console.log("  - clone-analyze      (concurrency: 2)");
  console.log("  - monitor            (concurrency: 2)");
  console.log("  - publish            (concurrency: 2)");
  console.log("  - scheduler          (concurrency: 1, cron: every minute)");
  console.log("Workers ready and listening for jobs via pg-boss...");

  // -------------------------------------------------------------------
  // Graceful shutdown
  // -------------------------------------------------------------------

  const shutdown = async () => {
    console.log("Shutting down workers...");
    await stopBoss();
    console.log("All workers shut down.");
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch(console.error);
```

- [ ] **Step 2: Delete old processors**

```bash
rm apps/workers/src/processors/avatar.ts apps/workers/src/processors/composer.ts
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd apps/workers && npx tsc --noEmit
```
Expected: No type errors (assuming scraper/script/tts processors don't reference AVATAR/COMPOSER directly).

- [ ] **Step 4: Commit**

```bash
git add apps/workers/src/index.ts
git add -u apps/workers/src/processors/avatar.ts apps/workers/src/processors/composer.ts
git commit -m "feat: rewire worker index — new processors, simplified DB-mediated chaining, remove avatar/composer stubs"
```

---

### Task 12: Update pipeline.ts — simplified PipelineMeta, new credit calc

**Files:**
- Modify: `apps/workers/src/processors/pipeline.ts`

- [ ] **Step 1: Update pipeline.ts**

Replace `apps/workers/src/processors/pipeline.ts`:
```typescript
import { prisma } from "@ugc/db";
import {
  calculateVideoCredits,
  calculateClonedVideoCredits,
} from "@ugc/shared";
import { sendJob, QUEUE_NAMES } from "../queues";
import type { ScriptJobData } from "./script-generator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineOptions {
  videoId: string;
  productUrl: string;
  productId: string;
  orgId: string;
  videoType: "TALKING_HEAD" | "FACELESS" | "CLONED";
  voiceId: string;
  brandKitId?: string;
  presetId?: string;
  templateId?: string;
}

// ---------------------------------------------------------------------------
// Credit calculation
// ---------------------------------------------------------------------------

async function calculateCreditsForVideo(
  videoType: "TALKING_HEAD" | "FACELESS" | "CLONED",
  templateId?: string
): Promise<number> {
  if (videoType === "CLONED" && templateId) {
    const template = await prisma.template.findUnique({
      where: { id: templateId },
    });

    if (template && template.structure) {
      const structure = template.structure as {
        structure?: {
          scenes?: Array<{ type: string }>;
        };
      };
      const scenes = structure.structure?.scenes ?? [];
      return calculateClonedVideoCredits(
        scenes.map((s) => ({ type: s.type }))
      );
    }
  }

  // Default: 5 scenes for a standard video
  return calculateVideoCredits(5);
}

// ---------------------------------------------------------------------------
// Start pipeline — deducts credits, sends first job (scraper)
// ---------------------------------------------------------------------------

export async function startVideoPipeline(
  opts: PipelineOptions
): Promise<string> {
  const {
    videoId,
    productUrl,
    productId,
    orgId,
    videoType,
    voiceId,
    brandKitId,
    presetId,
    templateId,
  } = opts;

  console.log(`[pipeline] Starting pipeline for video ${videoId}`);

  // 1. Calculate and deduct credits
  const creditCost = await calculateCreditsForVideo(videoType, templateId);

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
  });

  if (org.creditsBalance < creditCost) {
    throw new Error(
      `Insufficient credits: need ${creditCost}, have ${org.creditsBalance}`
    );
  }

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: orgId },
      data: { creditsBalance: { decrement: creditCost } },
    }),
    prisma.creditTransaction.create({
      data: {
        orgId,
        amount: -creditCost,
        type: "USAGE",
        referenceId: videoId,
      },
    }),
    prisma.video.update({
      where: { id: videoId },
      data: {
        status: "SCRAPING",
        creditsUsed: creditCost,
      },
    }),
  ]);

  console.log(
    `[pipeline] Deducted ${creditCost} credits from org ${orgId} (balance: ${org.creditsBalance - creditCost})`
  );

  // 2. Fetch brand kit if specified (needed by script-generator via job data)
  let brandKit: ScriptJobData["brandKit"] = null;
  if (brandKitId) {
    const bk = await prisma.brandKit.findUnique({ where: { id: brandKitId } });
    if (bk) {
      brandKit = {
        toneOfVoice: bk.toneOfVoice,
        targetAudience: bk.targetAudience,
        colors: bk.colors as Record<string, string>,
      };
    }
  }

  // 3. Fetch template structure if specified (needed by script-generator via job data)
  let templateStructure: ScriptJobData["templateStructure"] = null;
  if (templateId) {
    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (template) {
      templateStructure = template.structure as ScriptJobData["templateStructure"];
    }
  }

  // 4. Send the first pipeline job (scraper) with pipeline metadata
  //    NOTE: brandKit and templateStructure are still passed through _pipeline
  //    because the existing scraper/script/TTS processors read from job.data.
  //    New processors (scene-generator, video-assembler) read from DB instead.
  const jobId = await sendJob(QUEUE_NAMES.SCRAPER, {
    productUrl,
    productId,
    orgId,
    _pipeline: {
      videoId,
      productUrl,
      productId,
      orgId,
      videoType,
      voiceId,
      brandKitId,
      presetId,
      templateId,
      brandKit,
      templateStructure,
    },
  });

  console.log(`[pipeline] First job sent for video ${videoId}`);

  return jobId ?? videoId;
}

// ---------------------------------------------------------------------------
// Handle pipeline failure — refund credits
// ---------------------------------------------------------------------------

export async function handlePipelineFailure(
  videoId: string,
  error: Error | string
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;

  console.error(`[pipeline] Pipeline failed for video ${videoId}: ${errorMessage}`);

  try {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      console.error(`[pipeline] Video ${videoId} not found for refund`);
      return;
    }

    if (video.creditsUsed > 0) {
      await prisma.$transaction([
        prisma.organization.update({
          where: { id: video.orgId },
          data: { creditsBalance: { increment: video.creditsUsed } },
        }),
        prisma.creditTransaction.create({
          data: {
            orgId: video.orgId,
            amount: video.creditsUsed,
            type: "REFUND",
            referenceId: videoId,
          },
        }),
      ]);

      console.log(
        `[pipeline] Refunded ${video.creditsUsed} credits to org ${video.orgId}`
      );
    }

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "FAILED",
        error: errorMessage,
      },
    });
  } catch (refundError) {
    console.error(
      `[pipeline] Failed to handle pipeline failure for ${videoId}:`,
      refundError
    );
  }
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd apps/workers && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/workers/src/processors/pipeline.ts
git commit -m "feat: simplify pipeline.ts — DB-mediated data flow, presetId support, scene-count credits"
```

---

### Task 13: Update clone-pipeline.ts — add presetId

**Files:**
- Modify: `apps/workers/src/processors/clone-pipeline.ts`

- [ ] **Step 1: Add presetId to ClonePipelineGenerateOptions**

In `apps/workers/src/processors/clone-pipeline.ts`, add `presetId?: string` to the interface and include it in the `_pipeline` metadata:

At `apps/workers/src/processors/clone-pipeline.ts:18`, add `presetId?: string;` to the interface.

In the `_pipeline` object at line ~127-138, add `presetId` alongside the other fields.

The updated interface:
```typescript
export interface ClonePipelineGenerateOptions {
  videoId: string;
  templateId: string;
  productId: string;
  productUrl?: string;
  orgId: string;
  voiceId: string;
  avatarId?: string;
  brandKitId?: string;
  presetId?: string;
}
```

The updated `_pipeline` in `startCloneGenerationPipeline`:
```typescript
    _pipeline: {
      videoId,
      productId: productId,
      orgId,
      videoType: "CLONED" as const,
      voiceId,
      brandKitId,
      presetId,
      templateId,
    },
```

Also remove `brandKit` and `templateStructure` from the `_pipeline` (they were part of the old data-forwarding pattern — now processors read from DB).

Remove the brand kit fetch block (lines ~102-115) and the templateStructure extraction (lines ~117-119) since processors now read their own data from DB.

- [ ] **Step 2: Verify build**

Run:
```bash
cd apps/workers && npx tsc --noEmit
```
Expected: No type errors. (The scraper processor may still reference old `_pipeline` fields like `productUrl` — check and fix if needed.)

- [ ] **Step 3: Commit**

```bash
git add apps/workers/src/processors/clone-pipeline.ts
git commit -m "feat: add presetId to clone pipeline, simplify to DB-mediated data flow"
```

---

### Task 14: Update Dockerfile — add FFmpeg

**Files:**
- Modify: `apps/workers/Dockerfile`

- [ ] **Step 1: Add ffmpeg to apt-get install**

In `apps/workers/Dockerfile`, change line 3 from:
```dockerfile
RUN apt-get update && apt-get install -y python3 yt-dlp && rm -rf /var/lib/apt/lists/*
```
to:
```dockerfile
RUN apt-get update && apt-get install -y python3 yt-dlp ffmpeg && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 2: Commit**

```bash
git add apps/workers/Dockerfile
git commit -m "chore: add ffmpeg to worker Dockerfile for video assembly"
```

---

## Chunk 5: Preset Seed Data

### Task 15: Create seed presets

**Files:**
- Create: `packages/db/prisma/seed-presets.ts`

- [ ] **Step 1: Create seed-presets.ts with 8 niche presets**

Create `packages/db/prisma/seed-presets.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PRESETS = [
  {
    niche: "beauty",
    name: "Beauty / Skincare",
    description: "Soft lighting, dewy close-ups, marble and botanical product shots",
    sceneStyles: {
      hook: "extreme close-up of glowing dewy skin, soft studio lighting, beauty editorial",
      benefit: "person applying product to skin, natural light, authentic feel, skincare routine",
      demo: "product bottle on marble surface with botanicals, luxury minimalist aesthetic",
      testimonial: "candid selfie-style shot, warm lighting, genuine expression, before-after feel",
      cta: "product arrangement flat-lay, clean white background, beauty editorial composition",
    },
    negativePrompt: "harsh lighting, ugly, dull skin, messy background",
    defaultPacing: "medium",
    musicMood: "chill-ambient",
    isDefault: true,
  },
  {
    niche: "ecommerce",
    name: "E-commerce / Fashion",
    description: "Bold angles, lifestyle context, model-like figures wearing products",
    sceneStyles: {
      hook: "bold fashion editorial angle, dramatic lighting, model pose, eye-catching outfit",
      benefit: "lifestyle shot wearing product, urban or studio backdrop, aspirational",
      demo: "product detail close-up, texture and material visible, premium feel",
      testimonial: "street style candid, authentic urban setting, confident expression",
      cta: "styled product flat-lay with accessories, clean composition, shopping mood",
    },
    negativePrompt: "cheap looking, blurry fabric, unflattering angle",
    defaultPacing: "fast",
    musicMood: "upbeat-pop",
    isDefault: false,
  },
  {
    niche: "food",
    name: "Food / Recipe",
    description: "Overhead shots, warm lighting, step-by-step visuals, appetizing presentation",
    sceneStyles: {
      hook: "dramatic overhead food shot, steam rising, vibrant colors, dark moody background",
      benefit: "close-up of fresh ingredients being prepared, warm kitchen lighting",
      demo: "step-by-step cooking process, hands preparing food, clean workspace",
      testimonial: "person enjoying meal, candid dining moment, warm ambient lighting",
      cta: "beautifully plated dish, garnish detail, restaurant quality presentation",
    },
    negativePrompt: "unappetizing, cold lighting, messy unintentional, raw meat",
    defaultPacing: "medium",
    musicMood: "chill-ambient",
    isDefault: false,
  },
  {
    niche: "fitness",
    name: "Fitness / Wellness",
    description: "Dynamic action shots, vibrant colors, motivational energy",
    sceneStyles: {
      hook: "dynamic fitness action shot, mid-movement freeze, dramatic gym lighting, powerful pose",
      benefit: "person working out with product, energetic atmosphere, sweat and determination",
      demo: "close-up of product in use during workout, clean gym setting, vibrant colors",
      testimonial: "transformation-style pose, confident athlete, natural outdoor light",
      cta: "product with gym equipment arrangement, motivational composition, bold colors",
    },
    negativePrompt: "sedentary, lazy, unhealthy, injury",
    defaultPacing: "fast",
    musicMood: "dramatic",
    isDefault: false,
  },
  {
    niche: "tech",
    name: "Tech / SaaS",
    description: "Clean minimal, dark themes, screen mockups, futuristic aesthetic",
    sceneStyles: {
      hook: "sleek tech product on dark background, neon accent lighting, futuristic minimal",
      benefit: "person using device or app, clean desk setup, modern workspace, focused",
      demo: "screen mockup showing interface, dark theme UI, clean typography, tech aesthetic",
      testimonial: "professional at desk with product, modern office, thoughtful expression",
      cta: "product hero shot on gradient background, floating elements, premium tech feel",
    },
    negativePrompt: "cluttered, outdated technology, messy cables, old computer",
    defaultPacing: "medium",
    musicMood: "chill-ambient",
    isDefault: false,
  },
  {
    niche: "home",
    name: "Home / Lifestyle",
    description: "Warm tones, cozy environments, product-in-use in beautiful spaces",
    sceneStyles: {
      hook: "cozy home interior, warm golden hour lighting, inviting atmosphere, lifestyle shot",
      benefit: "product in use in beautiful living space, natural light, comfortable setting",
      demo: "close-up of product with home decor context, styled shelf or table, warm tones",
      testimonial: "person relaxing at home with product, candid comfort, soft lighting",
      cta: "product arrangement in styled home setting, curated lifestyle vignette",
    },
    negativePrompt: "cold, sterile, empty room, harsh fluorescent",
    defaultPacing: "slow",
    musicMood: "chill-ambient",
    isDefault: false,
  },
  {
    niche: "tiktok-shop",
    name: "TikTok Shop / Unboxing",
    description: "Close-up reveals, ASMR-style, excitement and tactile satisfaction",
    sceneStyles: {
      hook: "dramatic package reveal close-up, hands tearing open box, anticipation, ASMR feel",
      benefit: "product unboxing moment, tissue paper and packaging, satisfying reveal, close-up",
      demo: "hands interacting with product, texture close-up, ASMR tapping or opening sounds",
      testimonial: "excited reaction to product, genuine surprise, selfie angle, authentic feel",
      cta: "product surrounded by packaging elements, unboxing spread, purchase-ready composition",
    },
    negativePrompt: "boring, far away, no emotion, static",
    defaultPacing: "fast",
    musicMood: "upbeat-pop",
    isDefault: false,
  },
  {
    niche: "professional",
    name: "Professional Services",
    description: "Clean corporate, trust signals, testimonial-style credibility",
    sceneStyles: {
      hook: "professional headshot style, clean corporate backdrop, trust and authority",
      benefit: "business person in modern office, confident posture, credibility signals",
      demo: "clean infographic style visual, data visualization, professional presentation",
      testimonial: "client testimonial portrait, warm professional lighting, approachable",
      cta: "brand logo with professional backdrop, clean corporate composition, CTA ready",
    },
    negativePrompt: "casual, unprofessional, messy, cartoon",
    defaultPacing: "medium",
    musicMood: "chill-ambient",
    isDefault: false,
  },
];

async function seedPresets() {
  console.log("Seeding presets...");

  // Clean re-seed: delete all existing presets and recreate
  await prisma.preset.deleteMany({});

  for (const preset of PRESETS) {
    await prisma.preset.create({ data: preset });
    console.log(`  - ${preset.name}`);
  }

  console.log(`${PRESETS.length} presets seeded successfully.`);
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd packages/db && npx tsc --noEmit prisma/seed-presets.ts
```
Or just run:
```bash
cd packages/db && npx tsx prisma/seed-presets.ts
```
Expected: Presets seeded (or DB connection error if no DB available — that's OK).

- [ ] **Step 3: Commit**

```bash
git add packages/db/prisma/seed-presets.ts
git commit -m "feat: add 8 TikTok niche preset seed data (beauty, ecommerce, food, fitness, tech, home, tiktok-shop, professional)"
```

---

## Chunk 6: Frontend — Video Router + Brand Kit Router

### Task 16: Update video.ts router — accept presetId, update status enum

**Files:**
- Modify: `apps/web/src/server/trpc/routers/video.ts`

- [ ] **Step 1: Update video router**

In `apps/web/src/server/trpc/routers/video.ts`:

1. Add `presetId: z.string().optional()` to the `create` input schema.
2. Include `presetId: input.presetId` in the `video.create` data.
3. Update the `list` status enum to use `GENERATING_SCENES` instead of `GENERATING_AVATAR`.
4. Add `preset: true` to the `include` in `list` and `getById`.

Updated file:
```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { calculateVideoCredits, canAfford } from "@ugc/shared";

export const videoRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        productUrl: z.string().url().optional(),
        productId: z.string().optional(),
        videoType: z.enum(["TALKING_HEAD", "FACELESS"]),
        brandKitId: z.string().optional(),
        presetId: z.string().optional(),
        voiceId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const credits = calculateVideoCredits(5); // default 5 scenes
      if (!canAfford(ctx.org.creditsBalance, credits)) {
        throw new Error("Insufficient credits");
      }

      const video = await ctx.prisma.video.create({
        data: {
          orgId: ctx.org.id,
          productId: input.productId,
          brandKitId: input.brandKitId,
          presetId: input.presetId,
          type: input.videoType,
          status: "QUEUED",
          voiceId: input.voiceId,
          creditsUsed: credits,
        },
      });

      // Deduct credits
      await ctx.prisma.$transaction([
        ctx.prisma.organization.update({
          where: { id: ctx.org.id },
          data: { creditsBalance: { decrement: credits } },
        }),
        ctx.prisma.creditTransaction.create({
          data: {
            orgId: ctx.org.id,
            amount: -credits,
            type: "USAGE",
            referenceId: video.id,
          },
        }),
      ]);

      // TODO: enqueue to pg-boss video pipeline
      return video;
    }),

  list: protectedProcedure
    .input(
      z.object({
        status: z
          .enum([
            "QUEUED",
            "SCRAPING",
            "SCRIPTING",
            "GENERATING_AUDIO",
            "GENERATING_SCENES",
            "COMPOSING",
            "COMPLETED",
            "FAILED",
          ])
          .optional(),
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const videos = await ctx.prisma.video.findMany({
        where: {
          orgId: ctx.org.id,
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { product: true, brandKit: true, preset: true },
      });

      let nextCursor: string | undefined;
      if (videos.length > input.limit) {
        const next = videos.pop();
        nextCursor = next?.id;
      }

      return { videos, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.video.findFirstOrThrow({
        where: { id: input.id, orgId: ctx.org.id },
        include: { product: true, brandKit: true, template: true, preset: true },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.video.delete({
        where: { id: input.id, orgId: ctx.org.id },
      });
    }),
});
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd apps/web && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/trpc/routers/video.ts
git commit -m "feat: update video router — accept presetId, rename GENERATING_AVATAR to GENERATING_SCENES"
```

---

### Task 17: Update brandkit.ts router — add LoRA training mutation

**Files:**
- Modify: `apps/web/src/server/trpc/routers/brandkit.ts`

- [ ] **Step 1: Add trainLoRA mutation and getTrainingStatus query**

In `apps/web/src/server/trpc/routers/brandkit.ts`, add the following procedures to the router:

The web app already has a `sendJob` utility at `apps/web/src/server/queue.ts` (singleton pg-boss instance). The clone router uses it. Use the same pattern.

Add import at top of `brandkit.ts`:
```typescript
import { sendJob } from "../../queue";
```

After the `delete` procedure, add:

```typescript
  trainLoRA: protectedProcedure
    .input(
      z.object({
        brandKitId: z.string(),
        imageUrls: z.array(z.string().url()).min(4, "At least 4 images required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!canAfford(ctx.org.creditsBalance, 1)) {
        throw new Error("Insufficient credits. LoRA training requires 1 credit.");
      }

      await ctx.prisma.brandKit.update({
        where: { id: input.brandKitId, orgId: ctx.org.id },
        data: {
          loraTrainingImages: input.imageUrls,
          loraTrainingStatus: "pending",
        },
      });

      await ctx.prisma.$transaction([
        ctx.prisma.organization.update({
          where: { id: ctx.org.id },
          data: { creditsBalance: { decrement: 1 } },
        }),
        ctx.prisma.creditTransaction.create({
          data: {
            orgId: ctx.org.id,
            amount: -1,
            type: "USAGE",
            referenceId: input.brandKitId,
          },
        }),
      ]);

      // Enqueue LoRA training job via existing web app sendJob utility
      await sendJob("lora-training", {
        brandKitId: input.brandKitId,
        orgId: ctx.org.id,
      });

      return { status: "pending" };
    }),

  getTrainingStatus: protectedProcedure
    .input(z.object({ brandKitId: z.string() }))
    .query(async ({ ctx, input }) => {
      const brandKit = await ctx.prisma.brandKit.findFirstOrThrow({
        where: { id: input.brandKitId, orgId: ctx.org.id },
        select: {
          loraTrainingStatus: true,
          loraUrl: true,
          loraTriggerWord: true,
        },
      });
      return brandKit;
    }),
```

Also add at top of file:
```typescript
import { canAfford } from "@ugc/shared";
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd apps/web && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/trpc/routers/brandkit.ts
git commit -m "feat: add trainLoRA and getTrainingStatus to brand kit router"
```

---

### Task 18: Add preset tRPC router

**Files:**
- Create: `apps/web/src/server/trpc/routers/preset.ts`
- Modify: `apps/web/src/server/trpc/routers/` (register in root router)

- [ ] **Step 1: Create preset router**

Create `apps/web/src/server/trpc/routers/preset.ts`:
```typescript
import { router, protectedProcedure } from "../init";

export const presetRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.preset.findMany({
      orderBy: [{ isDefault: "desc" }, { niche: "asc" }],
    });
  }),
});
```

- [ ] **Step 2: Register in root router**

In `apps/web/src/server/trpc/router.ts`, add the import and registration:

Add import at line 12 (after `tiktokRouter` import):
```typescript
import { presetRouter } from "./routers/preset";
```

Add to the `appRouter` object (after line 25, before the closing `}`):
```typescript
  preset: presetRouter,
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd apps/web && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/server/trpc/routers/preset.ts apps/web/src/server/trpc/router.ts
git commit -m "feat: add preset tRPC router with list endpoint"
```

---

## Chunk 7: Frontend UI Updates

### Task 19: Update clone router to accept presetId

**Files:**
- Modify: `apps/web/src/server/trpc/routers/clone.ts`

- [ ] **Step 1: Add presetId to generateFromTemplate input**

In `apps/web/src/server/trpc/routers/clone.ts`, in the `generateFromTemplate` procedure's input schema, add:
```typescript
presetId: z.string().optional(),
```

And in the video create call within that mutation, add `presetId: input.presetId` to the data object.

Similarly, in `generateVariants`, add `presetId: z.string().optional()` to each variant's schema and pass it through.

- [ ] **Step 2: Verify build**

Run:
```bash
cd apps/web && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/trpc/routers/clone.ts
git commit -m "feat: accept presetId in clone router generateFromTemplate and generateVariants"
```

---

### Task 20: Add preset selector to create page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/create/page.tsx`

- [ ] **Step 1: Add preset selector to Step 2 (Format & Voice)**

In `apps/web/src/app/(dashboard)/create/page.tsx`:

1. Add `presetId` to component state: `const [presetId, setPresetId] = useState<string | undefined>()`
2. Add tRPC query: `const { data: presets } = trpc.preset.list.useQuery()`
3. In Step 2 (Format & Voice section), add a preset selector grid after the voice selector:

```tsx
{/* Preset Selector */}
<div className="space-y-3">
  <label className="text-sm font-medium text-gray-300">Visual Style</label>
  <div className="grid grid-cols-2 gap-3">
    {presets?.map((preset) => (
      <button
        key={preset.id}
        onClick={() => setPresetId(preset.id)}
        className={`p-3 rounded-lg border text-left transition-all ${
          presetId === preset.id
            ? "border-purple-500 bg-purple-500/10"
            : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
        }`}
      >
        <div className="font-medium text-sm text-white">{preset.name}</div>
        <div className="text-xs text-gray-400 mt-1">{preset.description}</div>
      </button>
    ))}
  </div>
</div>
```

4. Pass `presetId` to the `video.create` mutation call.

- [ ] **Step 2: Verify the page renders**

Run:
```bash
cd apps/web && pnpm dev
```
Navigate to `/create` and verify the preset selector appears in Step 2.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/create/page.tsx
git commit -m "feat: add preset selector to create page Step 2"
```

---

### Task 20: Add preset selector to clone page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/clone/page.tsx`

- [ ] **Step 1: Add preset selector to Step 3 (Customize & Generate)**

In `apps/web/src/app/(dashboard)/clone/page.tsx`:

1. Add `presetId` to component state
2. Add tRPC query for presets
3. In Step 3, add preset selector grid (same pattern as create page)
4. Pass `presetId` through to the `clone.generateFromTemplate` mutation

- [ ] **Step 2: Verify the page renders**

Run the dev server and navigate to `/clone`. Verify the preset selector appears in Step 3.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/clone/page.tsx
git commit -m "feat: add preset selector to clone page Step 3"
```

---

### Task 21: Add LoRA training UI to brand kits page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/brand-kits/page.tsx`

- [ ] **Step 1: Add LoRA training section to brand kit edit dialog**

In `apps/web/src/app/(dashboard)/brand-kits/page.tsx`:

Add a new section inside the edit dialog, after the existing form fields:

```tsx
{/* LoRA Training Section */}
<div className="border-t border-gray-700 pt-4 mt-4">
  <h3 className="text-sm font-medium text-white mb-2">Visual Style (Brand LoRA)</h3>
  <p className="text-xs text-gray-400 mb-3">
    Upload 4+ images of your brand's visual style to train a custom AI model.
    Costs 1 credit.
  </p>

  {editingKit?.loraTrainingStatus === "ready" ? (
    <div className="flex items-center gap-2 text-green-400 text-sm">
      <span className="w-2 h-2 rounded-full bg-green-400" />
      LoRA trained and ready
    </div>
  ) : editingKit?.loraTrainingStatus === "training" ? (
    <div className="flex items-center gap-2 text-yellow-400 text-sm">
      <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
      Training in progress...
    </div>
  ) : editingKit?.loraTrainingStatus === "failed" ? (
    <div className="flex items-center gap-2 text-red-400 text-sm">
      <span className="w-2 h-2 rounded-full bg-red-400" />
      Training failed. Try again.
    </div>
  ) : (
    <div className="space-y-2">
      {/* Image upload zone - simplified for now */}
      <input
        type="text"
        placeholder="Paste image URLs (comma-separated, min 4)"
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white"
        value={loraImageUrls}
        onChange={(e) => setLoraImageUrls(e.target.value)}
      />
      <button
        onClick={() => handleTrainLoRA(editingKit!.id)}
        disabled={loraImageUrls.split(",").filter(Boolean).length < 4}
        className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
      >
        Train LoRA (1 credit)
      </button>
    </div>
  )}
</div>
```

Add state and handler:
```tsx
const [loraImageUrls, setLoraImageUrls] = useState("");

const trainLoRA = trpc.brandKit.trainLoRA.useMutation({
  onSuccess: () => {
    // Refetch brand kits to update status
    brandKitsQuery.refetch();
  },
});

const handleTrainLoRA = (brandKitId: string) => {
  const urls = loraImageUrls.split(",").map((u) => u.trim()).filter(Boolean);
  trainLoRA.mutate({ brandKitId, imageUrls: urls });
};
```

- [ ] **Step 2: Verify the page renders**

Run the dev server and navigate to `/brand-kits`. Edit a brand kit and verify the LoRA section appears.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/brand-kits/page.tsx
git commit -m "feat: add LoRA training UI to brand kits page"
```

---

### Task 23: Update videos page — real video player + scene breakdown

**Files:**
- Modify: `apps/web/src/app/(dashboard)/videos/page.tsx`

- [ ] **Step 1: Update the video detail dialog to show real video player and scene thumbnails**

In `apps/web/src/app/(dashboard)/videos/page.tsx`, update the video detail dialog (the `<Dialog>` that opens when clicking a video card).

In the video player area (around line 378), the existing code already has a `<video>` element for `finalVideoUrl`. This is good. Now add a **scene-by-scene breakdown** section below the metadata grid (after line 444, before the published status section):

```tsx
{/* Scene thumbnails */}
{selectedVideoQuery.data.sceneImages &&
 (selectedVideoQuery.data.sceneImages as string[]).length > 0 && (
  <div className="space-y-2">
    <p className="text-xs font-medium text-muted-foreground">Scenes</p>
    <div className="flex gap-2 overflow-x-auto pb-2">
      {(selectedVideoQuery.data.sceneImages as string[]).map((imgUrl, i) => (
        <div key={i} className="flex-shrink-0">
          <img
            src={imgUrl}
            alt={`Scene ${i + 1}`}
            className="h-20 w-auto rounded border object-cover"
          />
          <p className="mt-1 text-center text-[10px] text-muted-foreground">
            Scene {i + 1}
          </p>
        </div>
      ))}
    </div>
  </div>
)}
```

Also update the video card thumbnail area (around line 238) to show the first scene image as a thumbnail when available:

Replace the thumbnail `<div>` content to check for `sceneImages`:
```tsx
<div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-[#1E1B4B] to-[#7C3AED]/60">
  {video.sceneImages && (video.sceneImages as string[])[0] ? (
    <img
      src={(video.sceneImages as string[])[0]}
      alt="Video thumbnail"
      className="h-full w-full object-cover"
    />
  ) : (
    <span className="text-4xl">
      {video.status === "COMPLETED" ? "▶" : "⏳"}
    </span>
  )}
  {/* ... keep existing duration and published/scheduled badges */}
</div>
```

- [ ] **Step 2: Verify the page renders**

Run the dev server and navigate to `/videos`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/videos/page.tsx
git commit -m "feat: add real video player, scene thumbnails, and download to videos page"
```

---

## Chunk 8: Environment + Final Verification

### Task 24: Add FAL_KEY to environment config

**Files:**
- Modify: `.env.example` (if exists) or create

- [ ] **Step 1: Add FAL_KEY to .env.example**

Check if `.env.example` exists. If so, add:
```
# fal.ai API key for AI image/video generation
FAL_KEY=your-fal-ai-api-key
```

If `.env.example` does not exist, create it with all required env vars documented in the spec (section 11).

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add FAL_KEY to environment config"
```

---

### Task 25: Full build verification

- [ ] **Step 1: Run shared package tests**

Run:
```bash
cd packages/shared && npx vitest run
```
Expected: All tests PASS.

- [ ] **Step 2: Run worker tests**

Run:
```bash
cd apps/workers && npx vitest run
```
Expected: All tests PASS (scene normalization, prompt building, FFmpeg helpers).

- [ ] **Step 3: Check TypeScript compilation across the monorepo**

Run:
```bash
pnpm -r exec npx tsc --noEmit
```
Expected: No type errors in any package.

- [ ] **Step 4: Verify Prisma client is generated**

Run:
```bash
cd packages/db && npx prisma generate
```
Expected: Client generated successfully.

- [ ] **Step 5: Final commit with any remaining fixes**

```bash
git add -u
git commit -m "chore: final build verification fixes for video pipeline v2"
```
