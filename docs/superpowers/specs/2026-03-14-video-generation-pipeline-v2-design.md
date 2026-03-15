# Video Generation Pipeline v2 — Design Spec

> **Goal:** Replace the stub composer and avatar processors with a real AI video generation pipeline using fal.ai, enabling ClipFork to produce actual TikTok/Instagram-ready videos.

> **Architecture:** Two new processors — Scene Generator (Flux + Kling V3 via fal.ai) and Video Assembler (FFmpeg) — replace the current stubs. A provider abstraction allows swapping inference backends later. A preset system makes powerful AI generation accessible to business owners.

> **Tech Stack:** fal.ai (Flux Pro for images, Kling V3 for video), FFmpeg (composition), ElevenLabs (TTS — already integrated), Cloudflare R2 (storage — already integrated), pg-boss (job queue — already integrated).

---

## 1. Context & Motivation

### What Exists Today

ClipFork has a working pipeline from scraping through TTS:

```
Scraper (Firecrawl) → Script Generator (Claude via OpenRouter) → TTS (ElevenLabs)
    → Avatar (STUB — returns null) → Composer (STUB — fake URL, marks COMPLETED)
```

The script generator produces structured scene arrays. TTS produces per-scene MP3 audio files uploaded to R2. But no actual video is ever produced — both avatar and composer are stubs.

#### Script Generator Output Types

The script generator produces different scene structures per video type:

**TALKING_HEAD** (`TalkingHeadScene`):
```typescript
{ type: "hook"|"benefit"|"demo"|"testimonial"|"cta", text: string, duration_s: number, emotion: string, gesture: string, transition: string }
```

**FACELESS** (`FacelessScene`):
```typescript
{ type: "hook"|"benefit"|"demo"|"testimonial"|"cta", text_overlay: string, voiceover: string, broll_description: string, duration_s: number, transition: string }
```

**CLONED** (`ClonedScene` — nested structure):
```typescript
{ hook: { type, duration_s, text_overlay? }, scenes: [{ type, duration_s, emotion?, text_overlay? }], cta: { type, duration_s, text_overlay? } }
```

#### Current Data Flow Problem

The current `chainNextPipelineStep()` in `index.ts` passes **empty stub data** at each stage (e.g., `scenes: []`, `script: ""`). Processor results are returned but never captured or forwarded. The `_pipeline` metadata is static — it carries config but not intermediate results.

**This spec addresses this by switching to database-mediated data flow**: each processor reads its input from the Video record (and related records) in the database, and writes its output back. The pipeline metadata only carries IDs and config, not data.

### What We're Building

```
Scraper → Script Generator → TTS → Scene Generator (NEW) → Video Assembler (NEW)
```

**Scene Generator**: For each scene, generates a starting image (Flux Pro) and animates it to video (Kling V3). All via fal.ai's unified API.

**Video Assembler**: Concatenates scene clips, overlays audio and captions, outputs final MP4 via FFmpeg.

### Why This Approach

- **No avatar providers** — HeyGen/D-ID are outdated. AI-native image + video generation is the cutting edge.
- **fal.ai as inference layer** — Unified API to every major model, pay-per-use, no GPU management. Swap models without architecture changes.
- **Presets for accessibility** — Business owners don't know how to prompt AI models. Presets encode niche-specific visual knowledge.
- **Brand LoRAs for differentiation** — Train on customer assets for visual consistency. Competitors with template-based approaches can't match this.

---

## 2. System Architecture

### Pipeline Flow

```
┌──────────┐    ┌────────────┐    ┌─────┐    ┌─────────────────┐    ┌─────────────────┐
│ Scraper  │───▶│  Script    │───▶│ TTS │───▶│ Scene Generator │───▶│ Video Assembler │
│          │    │  Generator │    │     │    │  (Flux + Kling) │    │   (FFmpeg)      │
└──────────┘    └────────────┘    └─────┘    └─────────────────┘    └─────────────────┘
     │                │               │              │                       │
     ▼                ▼               ▼              ▼                       ▼
  Product DB      Video.script    Video.audioUrl   Video.sceneVideos    Video.finalVideoUrl
  (scrapedData)   Video.variant   (per-scene R2)   Video.sceneImages    Video.status=DONE
```

### Data Flow: Database-Mediated

Each processor reads its inputs from database records and writes its outputs back. The pipeline `_pipeline` metadata carries only IDs and config — not the actual data payload. This solves the current problem of empty stub data being passed between steps.

**Read/Write pattern per processor:**

| Processor | Reads From | Writes To |
|-----------|-----------|----------|
| Scraper | Input URL | `Product.scrapedData`, `Product.images` |
| Script Generator | `Product.scrapedData`, `Video.type`, `BrandKit`, `Preset` | `Video.script`, `Video.scriptVariant` |
| TTS | `Video.scriptVariant` (scene texts) | `Video.audioUrl` (first), per-scene MP3s to R2 |
| Scene Generator | `Video.scriptVariant`, `Product.images`, `BrandKit`, `Preset` | `Video.sceneVideos`, `Video.sceneImages` |
| Video Assembler | `Video.sceneVideos`, `Video.audioUrl`, `Video.scriptVariant` | `Video.finalVideoUrl`, `Video.duration`, `status=COMPLETED` |

### Updated Pipeline Metadata

The `PipelineMeta` interface in `index.ts` is simplified — it only carries IDs:

```typescript
interface PipelineMeta {
  videoId: string;
  productId: string;
  orgId: string;
  videoType: "TALKING_HEAD" | "FACELESS" | "CLONED";
  voiceId: string;
  brandKitId?: string;
  presetId?: string;
  templateId?: string;
}
```

Each processor fetches what it needs from the database using `videoId`, `productId`, `brandKitId`, etc. This is cleaner and avoids the current problem of trying to forward large data payloads through job metadata.

### Job Chaining

The `chainNextPipelineStep()` function becomes simpler — it just passes the `_pipeline` metadata forward:

```typescript
async function chainNextPipelineStep(currentQueue: string, pipeline: PipelineMeta) {
  const next: Record<string, string> = {
    [QUEUE_NAMES.SCRAPER]: QUEUE_NAMES.SCRIPT,
    [QUEUE_NAMES.SCRIPT]: QUEUE_NAMES.TTS,
    [QUEUE_NAMES.TTS]: QUEUE_NAMES.SCENE_GENERATOR,
    [QUEUE_NAMES.SCENE_GENERATOR]: QUEUE_NAMES.VIDEO_ASSEMBLER,
  };
  const nextQueue = next[currentQueue];
  if (nextQueue) {
    await sendJob(nextQueue, { videoId: pipeline.videoId, _pipeline: pipeline });
  }
}
```

Each processor reads its own input data from the database using `pipeline.videoId`. No more empty stub data.

### Queue Name Changes

```typescript
export const QUEUE_NAMES = {
  // ... existing ...
  SCENE_GENERATOR: "scene-generator",    // replaces AVATAR
  VIDEO_ASSEMBLER: "video-assembler",    // replaces COMPOSER
  LORA_TRAINING: "lora-training",        // new
} as const;
```

Remove `AVATAR` and `COMPOSER`.

### Video Status Progression

```
QUEUED → SCRAPING → SCRIPTING → GENERATING_AUDIO → GENERATING_SCENES → COMPOSING → COMPLETED
```

`GENERATING_AVATAR` is renamed to `GENERATING_SCENES` in the Prisma enum.

---

## 3. New Processors

### 3.1 Scene Generator (`scene-generator.ts`)

Replaces `avatar.ts`. For each scene in the script:

1. **Read inputs from DB** — Fetch Video (with scriptVariant), Product (with images), BrandKit (with LoRA), Preset
2. **Normalize scenes** — Flatten all video types (TALKING_HEAD, FACELESS, CLONED) into a uniform scene list (see Normalization below)
3. **Generate image per scene** — Call Flux Pro via fal.ai (1080x1920, 9:16)
4. **Animate to video per scene** — Call Kling V3 via fal.ai (image-to-video, capped at 10s)
5. **Upload clips** — Store to R2: `videos/{videoId}/scenes/scene-{i}.mp4`
6. **Write outputs to DB** — Update Video with `sceneVideos` and `sceneImages` arrays
7. **Update status** — Set `status = GENERATING_SCENES` at start

#### Scene Normalization

All three video types produce different scene structures. The scene generator normalizes them into a uniform format before processing:

```typescript
interface NormalizedScene {
  type: string;                    // "hook", "benefit", "demo", "testimonial", "cta"
  visualDescription: string;       // what to generate visually
  captionText: string;             // text for caption overlay
  duration_s: number;
  emotion?: string;                // from TALKING_HEAD
}
```

**TALKING_HEAD** → `visualDescription` = scene.text (describes what the speaker is saying, used to generate a matching visual), `captionText` = scene.text

**FACELESS** → `visualDescription` = scene.broll_description, `captionText` = scene.voiceover || scene.text_overlay

**CLONED** → Flatten `{ hook, scenes[], cta }` into a single array. `visualDescription` = scene.text_overlay or scene type description, `captionText` = scene.text_overlay || ""

#### Scene-Type Visual Mapping

Each scene type maps to a visual generation strategy. These defaults are overridden by presets when available:

| Scene Type | Default Image Strategy | Default Video Motion |
|-----------|----------------------|---------------------|
| `hook` | Bold pattern-interrupt visual, dramatic close-up | Quick zoom or reveal |
| `benefit` | Product in use, showing value proposition | Slow zoom with soft lighting |
| `demo` | Product interaction, step-by-step visual | Pan or orbit around product |
| `testimonial` | Social proof visual, authentic candid feel | Minimal movement |
| `cta` | Product arrangement, call-to-action composition | Gentle zoom in |

#### Handling Scenes Longer Than 10 Seconds

Kling V3 supports max 10s per generation. For scenes longer than 10s:

1. Split into segments of max 10s each
2. Generate first segment with Kling I2V (image-to-video)
3. Use the last frame of segment N as the input image for segment N+1 (Kling supports this via its video extension API)
4. All segments for one scene are concatenated by the Video Assembler

Store as `sceneVideos` with nested arrays: `[["scene-0-part-0.mp4", "scene-0-part-1.mp4"], ["scene-1.mp4"], ...]`

#### fal.ai Concurrency Strategy

To avoid overwhelming fal.ai:
- Process scenes **sequentially within a single video** (not in parallel)
- The `localConcurrency` setting on the `scene-generator` queue controls how many videos are processed simultaneously (default: 2)
- fal.ai's `subscribe()` method handles queuing on their side with built-in retry
- Total max concurrent fal.ai calls = 2 videos × 2 calls/scene = 4 concurrent requests

This conservative approach avoids rate limits and keeps costs predictable. Can be tuned up later.

#### Error Handling

- **Per-scene retry**: Each fal.ai call retries up to 3 times (built into fal.ai's `subscribe`)
- **Timeout**: 5 minutes per scene (covers Kling's 60-120s generation time)
- **Scene failure**: If a scene fails after retries, the entire video fails
- **Model fallback**: If Kling V3 fails, try Wan 2.2 on fal.ai ($0.05/s, lower quality but more reliable)
- **Full failure**: `handlePipelineFailure()` refunds credits and marks video FAILED

### 3.2 Video Assembler (`video-assembler.ts`)

Replaces `composer.ts`. Reads all scene clips + audio from database/R2 and produces the final video.

#### Process

1. **Read inputs from DB** — Fetch Video (with sceneVideos, scriptVariant), get audioUrl
2. **Download assets** — Fetch all scene clips and audio files from R2 to temp directory
3. **Handle audio/scene mismatch** — TTS may skip scenes with empty text. For scenes without audio, insert silence of matching duration
4. **Concatenate scene clips** — FFmpeg `concat` demuxer, in scene order
5. **Overlay audio** — Map per-scene audio to corresponding time ranges
6. **Burn captions** — FFmpeg `drawtext` filter for caption text from each scene
7. **Output** — 1080x1920 MP4, H.264, 30fps, web-optimized (`-movflags +faststart`)
8. **Upload** — Store to R2: `videos/{videoId}/final.mp4`
9. **Update DB** — Set `finalVideoUrl`, `duration`, `status = COMPLETED`

#### Video Assembler Remains Terminal

The video assembler is the terminal step — it does NOT participate in the `chainNextPipelineStep` switch statement. It's handled separately (matching the current `COMPOSER` pattern in `index.ts`), with its own error handling that calls `handlePipelineFailure()` on failure.

#### FFmpeg Pipeline

```bash
ffmpeg \
  -f concat -safe 0 -i scenes.txt \
  -i audio_combined.mp3 \
  -filter_complex "[0:v]drawtext=fontfile=...:text='...':..." \
  -c:v libx264 -preset fast \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  -y output.mp4
```

#### Dependencies

FFmpeg must be installed on the worker. Add to Dockerfile:

```dockerfile
RUN apt-get update && apt-get install -y ffmpeg
```

---

## 4. fal.ai Provider Abstraction

### Interface

```typescript
// packages/shared/src/ai-provider.ts

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
  duration: number;        // seconds (capped at 10 for Kling)
  aspectRatio: "9:16" | "16:9" | "1:1";
}

export interface VideoGenerationResult {
  url: string;
  duration: number;
}

export interface LoRATrainingRequest {
  imageUrls: string[];     // 4+ image URLs — provider handles packaging
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

### fal.ai Implementation

```typescript
// apps/workers/src/providers/fal.ts

export class FalProvider implements AIProvider {
  constructor() {
    fal.config({ credentials: process.env.FAL_KEY });
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
    return { url: result.data.images[0].url, seed: result.data.seed };
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
    return { url: result.data.video.url, duration };
  }

  async trainLoRA(req: LoRATrainingRequest): Promise<LoRATrainingResult> {
    // fal.ai expects a ZIP of training images. The caller provides individual URLs.
    // We download, zip, and upload to a temporary URL before calling the training API.
    const zipUrl = await this.packageImagesAsZip(req.imageUrls);
    const result = await fal.subscribe("fal-ai/flux-lora-fast-training", {
      input: {
        images_data_url: zipUrl,
        trigger_word: req.triggerWord,
        steps: 1000,
      },
    });
    return { loraUrl: result.data.diffusers_lora_file.url, triggerWord: req.triggerWord };
  }

  private async packageImagesAsZip(imageUrls: string[]): Promise<string> {
    // Download images, create ZIP, upload to R2, return URL
    // Implementation detail — uses archiver or similar
  }
}
```

### Why an Abstraction

When we add ComfyUI self-hosting in Phase 2, it implements the same `AIProvider` interface. The scene generator doesn't care which backend runs the inference.

---

## 5. Preset System

### Purpose

Presets encode niche-specific visual knowledge so business owners don't need to understand AI prompting. They select "Beauty / Skincare" or "E-commerce / Fashion" and the system generates appropriate visuals.

### Data Model

```prisma
model Preset {
  id             String   @id @default(uuid())
  niche          String   // e.g., "beauty", "ecommerce", "food", "fitness", "saas"
  name           String   // e.g., "Clean Skincare", "Bold Fashion"
  description    String?
  sceneStyles    Json     // Record<string, string> — style prompts per scene type
  negativePrompt String?
  defaultPacing  String   @default("medium")  // "slow" | "medium" | "fast"
  musicMood      String?  // "chill-ambient", "upbeat-pop", "dramatic", etc.
  isDefault      Boolean  @default(false)
  createdAt      DateTime @default(now())
  videos         Video[]
}
```

The `sceneStyles` JSON maps scene types to visual style prompts:

```json
{
  "hook": "extreme close-up of glowing dewy skin, soft studio lighting, beauty editorial",
  "benefit": "person applying product, natural light, authentic feel",
  "demo": "product bottle on marble surface with botanicals, luxury minimalist",
  "testimonial": "candid selfie-style shot, warm lighting, genuine expression",
  "cta": "product arrangement flat-lay, clean white background"
}
```

### Seed Presets

Ship with 8 presets at `packages/db/prisma/seed-presets.ts`:

1. **Beauty / Skincare** — Soft lighting, dewy close-ups, marble/botanical product shots
2. **E-commerce / Fashion** — Bold angles, lifestyle context, model-like figures
3. **Food / Recipe** — Overhead shots, warm lighting, step-by-step visuals
4. **Fitness / Wellness** — Dynamic action shots, vibrant colors, motivational energy
5. **Tech / SaaS** — Clean minimal, dark themes, screen mockups, futuristic
6. **Home / Lifestyle** — Warm tones, cozy environments, product-in-use
7. **TikTok Shop / Unboxing** — Close-up reveal, ASMR-style, excitement
8. **Professional Services** — Clean corporate, trust signals, testimonial-style

### Preset + Scene Generator Integration

When generating an image for a scene, the prompt is constructed by layering:

```
[preset.sceneStyles[scene.type] — niche-specific visual style]
[product context — "featuring {productName}"]
[brand LoRA trigger — "in the style of {loraTriggerWord}" if available]
[scene content — scene.visualDescription from normalized scene]
[quality suffix — "professional product photography, 4k, sharp focus"]
```

Negative prompt = preset.negativePrompt + `"blurry, low quality, text, watermark, cartoon, illustration"`

---

## 6. Brand LoRA Integration

### Training Flow

1. User goes to Brand Kit settings
2. Uploads 4+ images (product photos, brand assets, style references)
3. System stores image URLs and enqueues a `lora-training` job
4. `lora-trainer.ts` processor calls `provider.trainLoRA()` with the image URLs
5. Provider packages images into ZIP, uploads, calls fal.ai training API
6. Training takes ~2-5 minutes, costs ~$2
7. LoRA URL stored on BrandKit record, status set to "ready"
8. All subsequent video generation uses the LoRA for Flux image generation

### Database Changes

Add to existing `BrandKit` model:

```prisma
model BrandKit {
  // ... existing fields (name, logoUrl, colors Json, toneOfVoice ToneOfVoice enum, targetAudience) ...
  loraUrl            String?
  loraTriggerWord    String?
  loraTrainingStatus String?   // "pending" | "training" | "ready" | "failed"
  loraTrainingImages Json?     // string[] — image URLs used for training
}
```

Note: `toneOfVoice` remains the existing `ToneOfVoice` enum (`CASUAL | PROFESSIONAL | HYPE | EDUCATIONAL | TESTIMONIAL`). `colors` remains `Json` (currently `Record<string, string>` — a map of color names to hex values). These are not changed.

### LoRA Trainer Processor (`lora-trainer.ts`)

Lightweight processor:

```typescript
interface LoRATrainingJobData {
  brandKitId: string;
  orgId: string;
}

async function processLoRATrainingJob(job: { data: LoRATrainingJobData }) {
  const brandKit = await prisma.brandKit.findFirstOrThrow({ where: { id: job.data.brandKitId } });
  const imageUrls = brandKit.loraTrainingImages as string[];

  await prisma.brandKit.update({ where: { id: brandKit.id }, data: { loraTrainingStatus: "training" } });

  const provider = new FalProvider();
  const result = await provider.trainLoRA({ imageUrls, triggerWord: `${brandKit.name.toLowerCase().replace(/\s+/g, "_")}_style` });

  await prisma.brandKit.update({
    where: { id: brandKit.id },
    data: { loraUrl: result.loraUrl, loraTriggerWord: result.triggerWord, loraTrainingStatus: "ready" },
  });
}
```

### Cost

LoRA training costs 1 credit, deducted when the user initiates training.

---

## 7. Database Schema Changes

### Updated Enums

```prisma
enum VideoStatus {
  QUEUED
  SCRAPING
  SCRIPTING
  GENERATING_AUDIO
  GENERATING_SCENES    // renamed from GENERATING_AVATAR
  COMPOSING
  COMPLETED
  FAILED
}
```

### Updated SceneType (in `packages/shared/src/types.ts`)

```typescript
export type SceneType = "hook" | "benefit" | "demo" | "testimonial" | "cta"
  | "talking_head" | "product_broll" | "text_overlay" | "greenscreen";
```

Adds `hook`, `benefit`, `demo`, `cta` to match what the script generator actually outputs. Keeps the existing types for backward compatibility with templates.

### Updated Video Model

```prisma
model Video {
  // ... existing fields ...
  presetId     String?
  preset       Preset?   @relation(fields: [presetId], references: [id])
  sceneVideos  Json?     // string[][] — per-scene video clip URLs (nested for multi-part scenes)
  sceneImages  Json?     // string[] — per-scene starting frame URLs (for thumbnails)
}
```

### New Preset Model

(See section 5 above)

### Migration Strategy

- Rename `GENERATING_AVATAR` to `GENERATING_SCENES` in the VideoStatus enum
- Add `presetId`, `sceneVideos`, `sceneImages` columns to Video
- Add LoRA fields to BrandKit
- Create Preset table and seed with initial presets
- Single Prisma migration, no data migration needed (no production videos exist yet)

---

## 8. Updated Credit System

### Breaking Change: New Function Signature

The existing `calculateVideoCredits(type: VideoType, durationSeconds: number)` changes to:

```typescript
export function calculateVideoCredits(sceneCount: number): number {
  // 2 credits per 5 scenes (or fraction), minimum 1
  return Math.max(1, Math.ceil(sceneCount / 5) * 2);
}

export function calculateClonedVideoCredits(scenes: Array<{ type: SceneType }>): number {
  // Keep existing per-type calculation for cloned videos
  // ... existing implementation ...
}
```

**Call sites that must be updated:**
- `apps/workers/src/processors/pipeline.ts` — `startVideoPipeline()` calls `calculateVideoCredits()`
- `apps/workers/src/processors/clone-pipeline.ts` — calls `calculateClonedVideoCredits()` (no change needed)
- `apps/web/src/server/trpc/routers/clone.ts` — calls `calculateClonedVideoCredits()` (no change needed)
- Any tests referencing `calculateVideoCredits`

### Cost Reality

Actual fal.ai costs per 5-scene, 30s video:

| Step | Cost |
|------|------|
| 5x Flux Pro image ($0.04/megapixel, ~2MP each) | ~$0.40 |
| 5x Kling V3 video ($0.11/sec × 6s avg) | ~$3.30 |
| TTS (ElevenLabs) | ~$0.05 |
| FFmpeg + R2 | ~$0.01 |
| **Total** | **~$3.76** |

At 2 credits per video, each credit costs us ~$1.88 in AI generation.

### Plan Pricing (must cover costs + margin)

| Plan | Credits/mo | AI Cost | Suggested Price | Margin |
|------|-----------|---------|----------------|--------|
| FREE | 3 | $5.64 | $0 | Loss leader |
| STARTER | 30 | $56.40 | $29/mo | -$27 (acquisition) |
| GROWTH | 100 | $188.00 | $99/mo | -$89 (needs optimization) |
| SCALE | 300 | $564.00 | $299/mo | -$265 (needs Phase 2 self-hosting) |

**Note:** These margins are negative at current fal.ai pricing. This is expected for Phase 1. Phase 2 (self-hosted ComfyUI + Wan 2.2) reduces per-video AI cost to ~$0.30-0.50, making all plans profitable. For Phase 1, limit FREE plan to 1 video (not 3 credits) and consider higher pricing or fewer credits on paid plans.

---

## 9. Frontend Changes

### Create Page Updates

**Step 2** (Format & Voice) adds:
- **Preset selector** — Grid of preset cards with niche icons
- Auto-suggest based on scraped product category
- Manual override available

**Step 3** (Script Review) — unchanged

**Step 4** (Generate) shows:
- Real progress through pipeline stages (status polling)
- First scene image as thumbnail preview when available

### Clone Page Updates

**Step 3** (Customize & Generate) adds:
- Preset selector (auto-matched based on analyzed video niche)

### Brand Kit Page Updates

New section: "Visual Style (Brand LoRA)"
- Upload zone for 4+ images
- Train button with progress indicator
- Status badge (training / ready / failed)
- "Requires 1 credit" notice

### Video Detail Page Updates

- Real video player with actual MP4
- Scene-by-scene breakdown with generated images as thumbnails
- Download button for final MP4

---

## 10. Worker Dockerfile Updates

```dockerfile
RUN apt-get update && apt-get install -y ffmpeg
```

Already installs yt-dlp for video downloading, so this follows the existing pattern.

---

## 11. Environment Variables

New required env var:

```
FAL_KEY=<fal.ai API key>
```

Add to workers (for scene generation, video generation, LoRA training) and web app (for LoRA training initiated from UI via tRPC → pg-boss job).

---

## 12. File Structure

### New Files

```
apps/workers/src/
  providers/
    fal.ts                           # fal.ai AIProvider implementation
  processors/
    scene-generator.ts               # NEW — replaces avatar.ts
    video-assembler.ts               # NEW — replaces composer.ts
    lora-trainer.ts                  # NEW — LoRA training processor

packages/shared/src/
  ai-provider.ts                     # AIProvider interface + types

packages/db/prisma/
  seed-presets.ts                    # Seed data for presets
```

### Modified Files

```
apps/workers/src/
  index.ts                           # Updated queue names, simplified chaining
  queues.ts                          # New queue name constants
  processors/pipeline.ts             # Pass presetId, updated credit calc
  processors/clone-pipeline.ts       # Pass presetId

apps/web/src/
  app/create/page.tsx                # Add preset selector
  app/clone/page.tsx                 # Add preset selector
  app/brand-kits/page.tsx            # Add LoRA training section
  app/videos/page.tsx                # Real video player

  server/trpc/routers/
    video.ts                         # Accept presetId in create mutation
    brandkit.ts                      # New LoRA training mutation

packages/shared/src/
  credits.ts                         # Updated calculateVideoCredits signature
  types.ts                           # Extended SceneType union

packages/db/prisma/
  schema.prisma                      # New Preset model, updated Video, BrandKit, VideoStatus enum
```

### Deleted Files

```
apps/workers/src/processors/avatar.ts    # Replaced by scene-generator.ts
apps/workers/src/processors/composer.ts  # Replaced by video-assembler.ts
```

---

## 13. Dependencies

### New npm packages

**Workers:**
- `@fal-ai/client` — fal.ai SDK
- `archiver` — ZIP creation for LoRA training image packaging

**Web:**
- `@fal-ai/client` — for LoRA training status polling (optional, could use tRPC polling instead)

### System Dependencies (Dockerfile)

- `ffmpeg` — video composition (add to existing Dockerfile)

---

## 14. What We're NOT Building (Phase 2+)

- **ComfyUI self-hosting** — For cost reduction on open-source models (Wan 2.2, Flux)
- **Video LoRAs** — HunyuanVideo fine-tuning for motion style consistency
- **Music/SFX generation** — Use silence or stock audio for now
- **Real-time preview** — Users see the final video after processing
- **A/B variant generation** — Batch variants with different presets
- **Analytics on published video performance** — Post-publish tracking
- **Multi-language UI** — ElevenLabs handles multi-language TTS, but interface is English-only
