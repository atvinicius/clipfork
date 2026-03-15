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

  await prisma.preset.deleteMany({});

  for (const preset of PRESETS) {
    await prisma.preset.create({ data: preset });
    console.log(`  - ${preset.name}`);
  }

  console.log(`${PRESETS.length} presets seeded successfully.`);
}

seedPresets()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
