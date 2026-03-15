# AI Video Generation Research: State of the Art (March 2026)

> Deep research for building a product that helps business owners create viral TikTok/Instagram content.

---

## Table of Contents

1. [ComfyUI and ComfyCloud](#1-comfyui-and-comfycloud)
2. [State of AI Video Generation Models](#2-state-of-ai-video-generation-models-march-2026)
3. [AI Image Generation for Video](#3-ai-image-generation-for-video)
4. [LoRAs for Video](#4-loras-for-video)
5. [ComfyUI for Programmatic Video Pipelines](#5-comfyui-for-programmatic-video-pipelines)
6. [What Viral TikTok Content Looks Like in 2026](#6-what-viral-tiktok-content-looks-like-in-2026)
7. [Competitive Landscape: AI UGC Platforms](#7-competitive-landscape-ai-ugc-platforms)
8. [Recommendations](#8-recommendations)

---

## 1. ComfyUI and ComfyCloud

### What is ComfyUI?

ComfyUI is the most powerful open-source node-based application for generative AI. Created by comfyanonymous and maintained by an active open-source community, it provides a visual graph/flowchart interface where users connect computational nodes to build complex AI generation pipelines -- without writing code.

- **GitHub**: https://github.com/comfyanonymous/ComfyUI
- **Docs**: https://docs.comfy.org
- **Self-description**: "The most powerful and modular diffusion model GUI, api and backend with a graph/nodes interface"

### Architecture

| Component | Details |
|-----------|---------|
| **Backend** | Python-based async execution engine with queue processing |
| **Frontend** | Web-based UI with real-time canvas manipulation |
| **API Server** | aiohttp application with REST + WebSocket endpoints |
| **Execution Engine** | Smart incremental execution -- only re-executes nodes that changed between runs |
| **Memory Management** | GPU offloading, works on systems with 1GB+ VRAM, supports CPU-only mode |

### Node-Based Workflow System

Workflows are JSON files composed of interconnected nodes. Each node represents an operation (load model, encode text, sample, decode, etc.). Key properties:

- Workflows are **portable** -- saved as JSON, or embedded in generated PNG/WebP metadata
- Nodes are **composable** -- any output can connect to compatible inputs
- The engine **caches** intermediate results, only re-running what changed
- Custom nodes can be installed from the community registry

### Supported Models (as of March 2026)

| Category | Models |
|----------|--------|
| **Image** | SD 1.x, SD 2.x, SDXL, Stable Cascade, SD3/3.5, Flux, AuraFlow, HunyuanDiT, Qwen, Omnigen2 |
| **Video** | Stable Video Diffusion, Mochi, LTX-Video, HunyuanVideo, Wan 2.1/2.2, Nvidia Cosmos |
| **Video (API nodes)** | Kling, Runway, Luma, MiniMax/Hailuo, Pika, PixVerse, Google Veo 2 |
| **Audio** | Stable Audio, ACE Step |
| **3D** | Hunyuan3D 2.0 |
| **Enhancements** | LoRAs, ControlNet, T2I-Adapter, IP-Adapter, embeddings, hypernetworks |

### ComfyUI API -- Local Server

ComfyUI exposes a full REST + WebSocket API when running locally. Key endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/prompt` | POST | Submit a workflow for execution |
| `/prompt` | GET | Get current queue info |
| `/queue` | GET/POST | View/manage execution queue |
| `/history/{prompt_id}` | GET | Get results of a completed workflow |
| `/view` | GET | Retrieve generated images/videos |
| `/upload/image` | POST | Upload input images |
| `/ws` | WebSocket | Real-time progress updates |
| `/system_stats` | GET | Server info (RAM, VRAM, GPU) |
| `/object_info` | GET | Node specifications and configs |
| `/api/jobs` | GET | List jobs with filtering/pagination |
| `/interrupt` | POST | Cancel current execution |
| `/free` | POST | Trigger memory cleanup |

**Programmatic workflow**: Connect via WebSocket, POST a workflow JSON to `/prompt`, listen for progress on the WebSocket, then GET results from `/history/{prompt_id}`.

### ComfyCloud

ComfyUI's documentation references a **Cloud API** for running workflows remotely without local GPU hardware. The cloud service offers:

- Remote workflow execution
- Asset management (upload/download)
- Job queuing and execution history
- Result retrieval

The Cloud API mirrors the local API pattern but runs on managed infrastructure. This is positioned as the official way to build cloud applications on top of ComfyUI workflows.

**Key insight for our product**: ComfyUI's API nodes also support calling external paid services (Kling, Runway, Veo, MiniMax, Pika, PixVerse, Luma) directly from within workflows. This means a single ComfyUI workflow can orchestrate: generate an image with Flux --> enhance it --> send it to Kling for video generation --> post-process the result. The node-based architecture makes this composable and reproducible.

---

## 2. State of AI Video Generation Models (March 2026)

### Tier 1: Frontier Models (Highest Quality)

#### Google Veo 3.1
- **Quality**: State-of-the-art across overall preference, visual quality, text alignment, physics simulation
- **Resolution**: Up to 4K
- **Audio**: Native audio synthesis with lip-sync, dialogue, sound effects, ambient noise
- **Duration**: 5-8 seconds
- **Features**: Text-to-video, image-to-video, scene extension, character consistency, camera control, style transfer, object insertion/removal, first/last frame transitions
- **API access**: Gemini API, Vertex AI Studio, Google AI Studio
- **Available on fal.ai**: $0.25-0.75/second depending on quality tier and audio
- **Verdict**: Best overall quality. Expensive but unmatched for cinematic output.

#### Runway Gen-4 / Gen-4 Turbo
- **Quality**: Top-tier commercial model
- **Pricing**: Credit-based. ~625 credits = 25 sec Gen-4.5 or 52 sec Gen-4
- **Plans**: Free ($0, 125 credits), Standard ($12/mo, 625 credits), Pro ($28/mo, 2250 credits), Unlimited ($76/mo)
- **API**: Gen-4 Turbo and Gen-4 Images available via API
- **Available on fal.ai**: Yes (endpoint exists)
- **Verdict**: Excellent quality, strong brand, expensive at scale through their platform. API access available.

#### OpenAI Sora 2
- **Quality**: High quality, "richly detailed dynamic clips with audio"
- **API**: Available via fal.ai (standard and Pro variants)
- **Available on fal.ai**: Yes, text-to-video and image-to-video
- **Pricing**: Via OpenAI's platform or fal.ai pricing
- **Verdict**: Strong model but OpenAI has been slower to roll out programmatic access compared to competitors.

### Tier 2: Best Value (Quality + Price)

#### Kling V3 / V3 Omni (by Kuaishou)
- **Quality**: Near-frontier quality, excellent motion and prompt adherence
- **Duration**: 3-15 seconds (configurable)
- **Features**: Text-to-video, image-to-video, video extension, lip sync, video effects, multi-image reference, virtual try-on, multi-shot sequences, native audio, voice synthesis
- **Aspect ratios**: 16:9, 9:16, 1:1
- **API pricing (direct)**: $0.084-$2.80/generation depending on model/quality/duration
- **API pricing (fal.ai)**: $0.112-0.196/second (Kling V3 Pro)
- **Volume discounts**: Available for bulk usage
- **ComfyUI integration**: Yes, via API nodes
- **Verdict**: Best price-to-quality ratio. Excellent API. Strong candidate for our use case. Up to 15 seconds is great for TikTok content.

#### MiniMax / Hailuo 2.3
- **Quality**: 1080p native, strong physics, good instruction-following
- **Features**: Text-to-video, image-to-video, director mode with camera control, voice cloning, text-to-speech
- **Plans (consumer)**: $7.99-199.99/mo
- **API**: Available via platform.minimaxi.com and fal.ai
- **212M+ individual users, 214K+ enterprise clients
- **ComfyUI integration**: Yes, via API nodes
- **Verdict**: Strong model, good pricing, massive user base proves reliability. Voice cloning is unique differentiator.

#### Luma Ray 3.14
- **Quality**: "World's first reasoning video model," native 1080p, HDR
- **Features**: Text-to-video, image-to-video, camera control, extend, loop, keyframe narrative control
- **Pricing**: 3x cheaper and 4x faster than Ray 3
- **API**: Available
- **25M creators on platform
- **Verdict**: Innovative reasoning approach. Good for storytelling. Competitive pricing.

### Tier 3: Open Source (Self-Hosted, Cheapest at Scale)

#### Wan 2.1 / 2.2 (by Alibaba)
- **Quality**: "Consistently outperforms existing open-source models and state-of-the-art commercial solutions"
- **Architecture**: Mixture of Experts (MoE) for 2.2, Flow Matching + DiT
- **Models**: 1.3B (consumer GPU, 8GB VRAM) and 14B (production quality)
- **Features**: Text-to-video, image-to-video, first-last-frame-to-video, video editing (VACE)
- **Resolution**: Up to 720p (1080p via VAE)
- **Self-hosted cost**: ~4 minutes for 5-sec 480p on RTX 4090
- **fal.ai pricing**: $0.05/second (Wan 2.5)
- **LoRA/fine-tuning**: Supports Diffusers library, trainable
- **ComfyUI integration**: Native, fully integrated with workflows for all variants
- **Most downloaded video model on HuggingFace (141K+ downloads for v2.2)
- **Verdict**: Best open-source option. Cheapest at scale if self-hosted. ComfyUI-native. The model to build custom pipelines on.

#### HunyuanVideo (by Tencent)
- **Quality**: High quality, good text alignment and motion
- **Pricing on Replicate**: ~$1.26/run, 4 min on 4x H100
- **LoRA/fine-tuning**: YES -- Replicate offers LoRA fine-tuning. 5-10 min training. Can capture visual style AND motion style.
- **Verdict**: Currently the best model for LoRA fine-tuning of video. Key for brand consistency use case.

#### LTX-Video (by Lightricks)
- **Quality**: Efficient, good for quick generation
- **Versions**: 0.9.5, 2.0, 2.3
- **Features**: Text-to-video, image-to-video, multi-frame control, audio support in newer versions
- **ComfyUI integration**: Native, with tutorials
- **Key note**: "Long descriptive prompts" are essential for quality
- **Verdict**: Fast and efficient. Good for prototyping. Less quality than Wan/Kling.

### Tier 4: Specialty / Niche

#### Pika (Pikaformance model)
- **Specialty**: Hyper-real expressions synced to audio. "Make your images sing, speak, rap, bark"
- **Plans**: Free (80 credits), Standard ($8/mo), Pro ($28/mo), Fancy ($76/mo)
- **API**: Available via fal.ai
- **Verdict**: Excellent for lip-sync/expression content. Niche but powerful.

#### PixVerse V5.x
- **Features**: Multi-shot sequences, lip-sync, audio generation, character consistency, multi-frame control
- **API**: Full-stack API available
- **Scale**: 177+ countries, claims 68% cost reduction and 57% faster production for enterprises
- **ComfyUI integration**: Yes, via API nodes
- **Verdict**: Enterprise-focused. Good feature set.

### Pricing Comparison (via fal.ai, per second of video output)

| Model | Price/Second | 5-sec Video Cost | Notes |
|-------|-------------|-----------------|-------|
| Wan 2.5 | $0.05 | $0.25 | Open source, cheapest |
| Kling 2.5 Turbo Pro | $0.07 | $0.35 | Great value |
| Kling V3 Pro (no audio) | $0.112 | $0.56 | Higher quality |
| Kling V3 Pro (audio) | $0.168 | $0.84 | With native audio |
| Veo 3 Fast (no audio) | $0.25 | $1.25 | Google quality |
| Veo 3 (audio) | $0.75 | $3.75 | Premium tier |
| Sora 2 | ~$0.30-0.50 | ~$1.50-2.50 | Estimated |

### API Aggregators (Key Finding)

**fal.ai** emerges as the most important platform for our use case. It provides:
- Unified API access to nearly every major video model (Kling, Veo, Sora, Wan, Pika, PixVerse, LTX, Runway, Hailuo/MiniMax)
- Pay-per-use pricing with no subscriptions
- SDKs for JavaScript and Python
- Queue API for async processing with webhooks
- GPU compute for custom model hosting ($0.99-2.10/hr)

This means we could build our product on fal.ai as the inference layer and switch between models without changing our architecture.

---

## 3. AI Image Generation for Video

### The Image-to-Video Pipeline

The dominant workflow for high-quality AI video in 2026 is a two-stage pipeline:

1. **Generate a high-quality still image** (character, product, scene) using an image model
2. **Animate the image** using an image-to-video model

This approach gives far more control than pure text-to-video because you can perfect the starting frame before animation.

### Image Generation Models

#### Flux (by Black Forest Labs)
- **Flux 1.1 Pro**: 12B parameter flow transformer. "Highest Elo score on Artificial Analysis image arena." 6x faster than Flux 1.0 Pro.
- **Pricing on fal.ai**: $0.04/megapixel (Flux Pro), $0.035/megapixel (Flux LoRA)
- **LoRA support**: Full support. Multiple LoRAs can be applied simultaneously.
- **Verdict**: Best image generation model for our pipeline. Fast, high quality, LoRA-ready.

#### Flux 2 Flex
- Newer version with adjustable inference steps and guidance scale
- Fine-tuned control over generation

#### SDXL
- Still widely used, especially for LoRA training
- Huge ecosystem of community LoRAs
- Less quality than Flux but more mature ecosystem

### The Workflow in Practice

```
1. Train a LoRA on brand assets (product photos, character reference, style guide)
2. Generate a starting frame with Flux + brand LoRA
   - Product in-context shot
   - Character in a scene
   - Brand-consistent environment
3. Optionally enhance with ControlNet/IP-Adapter for pose/composition control
4. Send the image to an I2V model (Kling, Veo, Wan, etc.)
5. Post-process: upscale, add audio, add text overlays
```

### ComfyUI as the Orchestrator

ComfyUI is ideal for this pipeline because a single workflow can:
- Load a Flux model with a custom LoRA
- Generate an image from a text prompt
- Optionally apply ControlNet for specific poses
- Pipe the image directly to a video generation node (Kling API, Wan local, etc.)
- All as a reproducible, parameterized JSON workflow

---

## 4. LoRAs for Video

### What Are LoRAs?

LoRA (Low-Rank Adaptation) is a technique for fine-tuning large models by training a small set of additional parameters rather than the full model. This makes training fast, cheap, and produces small portable files (~50-200MB) that can be swapped in and out.

### LoRAs for Image Generation (Mature)

**Current state**: Highly mature. The primary way to customize image models for brand consistency.

- **Training on fal.ai**: $2/training run, ~1000 steps, minimum 4 images
- **Training time**: Minutes, not hours
- **Use cases**: Brand style, specific products, character consistency, artistic style
- **How it works**: Provide 4+ images of your subject/style + trigger word. The LoRA learns to associate the trigger word with the visual concept.
- **Application**: Multiple LoRAs can be stacked (e.g., brand style LoRA + product LoRA)

### LoRAs for Video Generation (Emerging)

**Current state**: Early but functional. HunyuanVideo is the leader.

#### HunyuanVideo LoRA Fine-Tuning (via Replicate)
- **Training time**: 5-10 minutes
- **Training data**: Video clips + text captions
- **What it captures**: "Not only the visual appearance and color grading, but also the motion of the camera and the way the characters move"
- **Tested styles**: Twin Peaks, Pixar, Cowboy Bebop, Westworld -- each producing distinct motion AND visual style
- **Key insight**: Video LoRAs capture motion patterns, not just aesthetics. This is impossible with image-only models.

#### Wan 2.1/2.2 LoRA Support
- Wan supports the Diffusers library, which means standard LoRA training tools work
- ComfyUI integration means LoRAs can be loaded in video workflows
- Less proven than HunyuanVideo for video-specific fine-tuning

### LoRA Strategy for Our Product

For brand consistency in TikTok/Instagram content:

1. **Image LoRA (Flux)**: Train on brand visual identity (colors, style, product shots). Use this to generate consistent starting frames.
2. **Video LoRA (HunyuanVideo)**: Train on example videos showing desired motion style, pacing, camera work.
3. **Combine**: Generate brand-consistent image with Flux+LoRA --> Animate with HunyuanVideo+LoRA or send to Kling API.

This two-LoRA approach gives brand consistency in both still frames AND motion style.

---

## 5. ComfyUI for Programmatic Video Pipelines

### Can ComfyUI Workflows Be Triggered via API?

**Yes, absolutely.** The ComfyUI server exposes a full REST + WebSocket API.

#### The Programmatic Pattern

```
1. Export a workflow as JSON (from the UI, or build programmatically)
2. POST the workflow JSON to /prompt endpoint
3. Monitor execution via WebSocket connection
4. GET results from /history/{prompt_id}
5. Download generated files from /view endpoint
```

This is already used in production by many projects. The workflow JSON is essentially a declarative pipeline specification.

### How to Build a SaaS on ComfyUI

#### Option A: Self-Hosted ComfyUI + Custom API Layer

```
[Your SaaS Frontend]
    |
[Your API Server (Next.js/FastAPI)]
    |
[ComfyUI Backend Server(s)]
    |
[GPU Infrastructure (cloud)]
```

- Deploy ComfyUI on GPU servers (cloud VMs with NVIDIA GPUs)
- Build an API layer that translates user requests into ComfyUI workflow JSON
- Submit workflows via ComfyUI's REST API
- Scale by running multiple ComfyUI instances behind a load balancer
- Use a queue system (Redis, SQS) for job management

**Pros**: Full control, cheapest at scale, can use any model
**Cons**: GPU infrastructure management, scaling complexity

#### Option B: ComfyUI Cloud API

- Use ComfyUI's managed cloud service
- Upload workflows once, trigger via cloud API
- No GPU management needed

**Pros**: No infrastructure management
**Cons**: Less control, potential vendor lock-in, pricing TBD

#### Option C: fal.ai as Inference Backend (Recommended Starting Point)

```
[Your SaaS Frontend]
    |
[Your API Server]
    |
[fal.ai API] --> Multiple models (Kling, Veo, Wan, Flux, etc.)
```

- Use fal.ai's unified API for model inference
- Pay-per-use, no GPU management
- Switch between models without infrastructure changes
- Webhooks for async processing

**Pros**: Fastest to market, model flexibility, no GPU ops
**Cons**: Per-call costs higher than self-hosted at scale, less workflow customization than ComfyUI

#### Option D: Hybrid Approach (Best Long-Term)

```
[Your SaaS Frontend]
    |
[Your API Server]
    |
    |--> [fal.ai] for proprietary models (Kling, Veo, Sora)
    |--> [Self-hosted ComfyUI] for open-source models (Wan, Flux) + custom LoRAs
```

Start with fal.ai for speed to market, then add self-hosted ComfyUI for:
- Custom LoRA workflows that need local model loading
- Open-source models where self-hosting is cheaper at scale
- Complex multi-step workflows with intermediate processing

### Alternatives to ComfyUI for Programmatic Pipelines

| Platform | What It Does | Pros | Cons |
|----------|-------------|------|------|
| **fal.ai** | Serverless AI model API | Easy, many models, pay-per-use | No complex workflows, per-call pricing |
| **Replicate** | Model hosting + API (now part of Cloudflare) | Simple API, fine-tuning support | Fewer models than fal.ai |
| **RunPod** | GPU cloud for self-hosting | Cheap GPUs, flexible | Must manage everything |
| **Modal** | Serverless GPU compute | Python-native, auto-scaling | Less ecosystem for AI models |
| **BentoML** | Model serving framework | Self-hosted, efficient | More engineering overhead |

---

## 6. What Viral TikTok Content Looks Like in 2026

### Platform Statistics (2026)

| Metric | Value |
|--------|-------|
| Monthly active users | 1.99 billion globally, 136M in U.S. |
| Average engagement rate | 3.73% (far ahead of all other platforms, which are <1%) |
| Daily time per user | 1 hour 37 minutes |
| App opens per day | ~10 times |
| Projected ad revenue (2026) | $34.8 billion |
| TikTok Shop users | 870 million, avg $700 spent across 12 purchases |
| Most popular category | Beauty/personal care (370M units sold) |
| Marketer adoption | Only 26% of marketers use TikTok (massive opportunity gap) |

### Primary Demographics

- **Largest segment**: Males 25-34 (35.3%)
- **Gen Z**: 72% have accounts, ~60% of users
- **Gender**: 55.7% male, 44.3% female

### What Content Formats Work

1. **Short-form video under 60 seconds** -- 60% of users engage with these
2. **Videos over 60 seconds** -- receive 43% more reach and 64% more watch time (emerging trend: longer is better if engaging)
3. **Content series** -- episodic storytelling builds loyal audiences
4. **Reply videos** -- responding to comments with video (10K+ view increases)
5. **Carousels** -- gaining momentum (7% fewer views than video, but growing)

### Viral Content Principles

- **Strong hooks with curiosity gaps** -- the first 1-2 seconds determine everything
- **Authentic over polished** -- casual, UGC-style content outperforms studio production
- **Consistency matters enormously** -- creators posting weekly for 20+ weeks get 450% more engagement per post
- **Trending sounds/challenges** -- when aligned with brand, these amplify reach
- **Duets/stitches** -- collaboration format drives discovery

### Best Posting Times

- **Best days**: Monday-Thursday
- **Peak times**: 6-9 PM Monday; 5-9 PM Tuesday-Thursday

### How AI-Generated Content is Performing

The intersection of AI and TikTok content is at an inflection point:

- **AI UGC-style ads** are becoming standard for D2C brands and app marketing
- **AI avatars** delivering product pitches are increasingly indistinguishable from real creators
- **AI-generated product shots** with lifestyle contexts perform as well as (sometimes better than) photographed content
- **The key differentiator** is still the script and hook quality -- AI handles production, humans handle strategy

### Niches Where AI Content Excels

1. **Beauty/personal care** -- largest TikTok Shop category, product demos work well with AI
2. **E-commerce/D2C** -- product showcase videos, virtual try-ons
3. **Mobile apps** -- AI actors explaining features, screen recordings with AI narration
4. **Digital products/courses** -- talking-head explainers
5. **Food/recipes** -- AI-generated step-by-step visuals
6. **Fashion** -- virtual try-on, outfit showcases

---

## 7. Competitive Landscape: AI UGC Platforms

### Direct Competitors (AI Video for Ads/Social)

#### Arcads (arcads.ai)
- **Focus**: AI UGC video ads
- **Key feature**: 1,000+ AI actors, custom AI avatars that can hold products and wear branded clothing
- **Capabilities**: B-rolls, music, captions, transitions in one click. Emotion control. 30+ language translation/dubbing.
- **Target market**: D2C brands, mobile app studios, marketing agencies
- **Limitation**: Pre-built template approach, limited customization vs. what a ComfyUI pipeline could offer

#### Synthesia (synthesia.io)
- **Focus**: Professional AI video creation
- **Scale**: 50,000+ customers, 240+ AI avatars, 140+ languages
- **Key feature**: Custom branded avatars with company logos/fonts
- **Rating**: 4.7 stars (~1,800 reviews)
- **Target market**: Enterprise -- training, sales enablement, compliance
- **Limitation**: Enterprise-focused, expensive, not optimized for viral social content

#### Creatify (creatify.ai)
- **Focus**: AI ad generation
- **Tagline**: "Create Winning Ads with AI"
- **Target**: Performance marketers
- **Limitation**: Details limited but appears to be a direct competitor

#### Predis.ai
- **Focus**: AI social media content creation
- **Scale**: 6.4M+ users, 200M+ ads generated
- **Key features**: UGC-style videos with customizable avatars, AI voiceovers, auto-resizing for platforms, A/B testing, dedicated TikTok ad maker
- **Languages**: 19+
- **Target**: Creators, agencies, e-commerce
- **Limitation**: Jack-of-all-trades approach, may lack depth in video quality

#### HeyGen (heygen.com)
- **Focus**: AI avatar video platform
- **Known for**: High-quality avatar lip-sync, translation/dubbing
- **Target**: Enterprise and content creators

### How We Would Differentiate

The existing players are mostly **template-based avatar platforms**. They:
- Use pre-built AI actors/avatars
- Focus on talking-head formats
- Offer limited visual customization
- Cannot generate novel scenes, products, or environments

Our opportunity with a ComfyUI/model-based approach:
- **Generate any visual** -- not limited to pre-built avatars
- **Brand LoRAs** -- train on actual brand assets for true visual consistency
- **Full scene generation** -- create product shots, environments, characters from scratch
- **Multi-model orchestration** -- use the best model for each step (Flux for images, Kling for video, Pika for lip-sync)
- **Novel content types** -- surreal/creative AI videos that go viral precisely because they look AI-generated (a growing trend)

---

## 8. Recommendations

### Model Strategy

| Use Case | Recommended Model | Why |
|----------|------------------|-----|
| **Image generation (starting frames)** | Flux 1.1 Pro or Flux 2 | Best quality, LoRA support, fast, cheap ($0.04/MP) |
| **Brand LoRA training** | Flux LoRA on fal.ai | $2/training, minutes to train, excellent results |
| **Video (best value)** | Kling V3 Pro | Best price/quality, 3-15 sec, 9:16 support, audio, $0.11-0.17/sec |
| **Video (highest quality)** | Veo 3.1 | State-of-the-art quality and audio, but 3-5x more expensive |
| **Video (cheapest)** | Wan 2.2 via fal.ai | $0.05/sec, open source, self-hostable for even lower cost |
| **Video LoRA (brand motion style)** | HunyuanVideo on Replicate | Only model with proven video LoRA fine-tuning |
| **Lip-sync/expressions** | Pika (Pikaformance) or Kling lip-sync | Specialized for making images speak/sing |
| **Self-hosted pipeline** | ComfyUI + Wan 2.2 + Flux | Full control, cheapest at scale, most flexible |

### Infrastructure Recommendation

**Phase 1 (MVP / 0-6 months)**: Build on fal.ai
- Use fal.ai as unified inference backend
- Kling V3 for video (best value)
- Flux Pro for image generation
- Flux LoRA training for brand customization
- Focus engineering on UX, prompt engineering, template design
- Cost: ~$0.50-2.00 per video generated

**Phase 2 (Scale / 6-12 months)**: Add ComfyUI
- Deploy self-hosted ComfyUI on GPU cloud (RunPod/Lambda)
- Move open-source model inference (Wan, Flux) to self-hosted for cost reduction
- Keep proprietary models (Kling, Veo) on fal.ai
- Build complex multi-step workflows (image gen --> enhance --> animate --> post-process)
- Cost reduction: 50-70% on open-source model calls

**Phase 3 (Differentiation / 12+ months)**: Custom LoRA Pipeline
- Offer customers the ability to train brand LoRAs
- Video LoRA training on HunyuanVideo for motion consistency
- Full ComfyUI workflow orchestration
- This becomes a moat -- competitors with template-based approaches cannot match this

### Product Format Recommendations for TikTok/Instagram

Based on what performs well:

1. **Product showcase videos** (5-10 sec) -- AI-generated product in lifestyle context, animated
2. **UGC-style testimonials** -- AI avatar delivering a script in casual style
3. **Before/after transformations** -- split-screen showing product results
4. **Hook-first explainers** -- 3-sec hook + 15-sec explanation, AI-generated visuals throughout
5. **Trending sound + product** -- AI-generated visuals synced to trending audio
6. **Series content** -- AI-generated episodic content for brand channels

### Key Risks

1. **Platform policy**: TikTok/Instagram may tighten rules on AI-generated content disclosure. Monitor closely.
2. **Quality threshold**: AI video quality is improving monthly. Content that looks "obviously AI" may underperform unless the AI aesthetic is intentional.
3. **Model pricing changes**: fal.ai and model providers may change pricing. Design for model portability.
4. **Open-source velocity**: Wan and similar models are improving rapidly. The gap between open-source and proprietary is closing fast.

### Key Links

| Resource | URL |
|----------|-----|
| ComfyUI GitHub | https://github.com/comfyanonymous/ComfyUI |
| ComfyUI Docs | https://docs.comfy.org |
| fal.ai (model API) | https://fal.ai |
| Replicate (fine-tuning) | https://replicate.com |
| Kling API | https://klingai.com |
| MiniMax/Hailuo | https://minimaxi.com |
| Runway API | https://www.runwayml.com/api |
| Luma Labs API | https://lumalabs.ai/api |
| Wan 2.1/2.2 | https://github.com/Wan-Video/Wan2.1 |
| HunyuanVideo | https://huggingface.co/tencent/HunyuanVideo |
| Flux on fal.ai | https://fal.ai/models/fal-ai/flux-pro/v1.1 |
| Flux LoRA Training | https://fal.ai/models/fal-ai/flux-lora-fast-training |
