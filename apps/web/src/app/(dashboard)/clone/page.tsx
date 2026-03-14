"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateStructure {
  structure: {
    hook: {
      type: string;
      duration_s: number;
      text_overlay?: boolean;
    };
    scenes: Array<{
      type: string;
      duration_s: number;
      emotion?: string;
      gesture?: string;
      transition?: string;
      text_overlay?: boolean | string;
    }>;
    cta: {
      type: string;
      duration_s: number;
      text_overlay?: boolean;
    };
  };
  style: {
    pacing: string;
    music_mood: string;
    caption_style: string;
    color_tone: string;
  };
  format: {
    aspect: string;
    total_duration_s: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLACEHOLDER_AVATARS = [
  { id: "avatar-1", name: "Sarah" },
  { id: "avatar-2", name: "James" },
  { id: "avatar-3", name: "Maria" },
  { id: "avatar-4", name: "Alex" },
  { id: "avatar-5", name: "Priya" },
  { id: "avatar-6", name: "Lucas" },
];

const PLACEHOLDER_VOICES = [
  { id: "voice-1", name: "Confident Female" },
  { id: "voice-2", name: "Friendly Male" },
  { id: "voice-3", name: "Energetic Female" },
  { id: "voice-4", name: "Calm Male" },
  { id: "voice-5", name: "Professional Female" },
];

const HOOK_TYPE_ICONS: Record<string, string> = {
  question: "?",
  story: "S",
  shock: "!",
  statistic: "#",
};

const SCENE_TYPE_ICONS: Record<string, string> = {
  talking_head: "TH",
  product_broll: "BR",
  text_overlay: "TX",
  testimonial: "TM",
  greenscreen: "GS",
};

const CTA_TYPE_LABELS: Record<string, string> = {
  urgency: "Urgency",
  scarcity: "Scarcity",
  social_proof: "Social Proof",
};

const SCENE_CREDIT_MAP: Record<string, number> = {
  talking_head: 1,
  product_broll: 0.25,
  text_overlay: 0.25,
  testimonial: 0.25,
  greenscreen: 0.25,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateCreditsFromStructure(
  structure: TemplateStructure | null
): number {
  if (!structure) return 0;
  return structure.structure.scenes.reduce((total, scene) => {
    return total + (SCENE_CREDIT_MAP[scene.type] ?? 0.25);
  }, 0);
}

function getPacingColor(pacing: string): string {
  switch (pacing) {
    case "slow":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "medium":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "fast":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CloneViralPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1: URL input
  const [url, setUrl] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState("");

  // Step 2: Analysis result
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [structure, setStructure] = useState<TemplateStructure | null>(null);

  // Step 3: Customize
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [brandKitId, setBrandKitId] = useState("");
  const [sceneScripts, setSceneScripts] = useState<Record<number, string>>({});

  // Step 4: Generate
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [variantCount, setVariantCount] = useState(1);

  // Queries
  const productsQuery = trpc.product.list.useQuery({ limit: 50 });
  const brandKitsQuery = trpc.brandKit.list.useQuery();
  const creditsQuery = trpc.credits.getBalance.useQuery();

  // Mutations
  const analyzeMutation = trpc.clone.analyzeUrl.useMutation();
  const generateMutation = trpc.clone.generateFromTemplate.useMutation();
  const batchMutation = trpc.clone.generateVariants.useMutation();

  // When templateId is set, fetch the analysis
  const analysisQuery = trpc.clone.getAnalysis.useQuery(
    { templateId: templateId! },
    { enabled: !!templateId }
  );

  // Load analysis result into state
  useEffect(() => {
    if (analysisQuery.data?.structure) {
      setStructure(analysisQuery.data.structure as TemplateStructure);
    }
  }, [analysisQuery.data]);

  // Credit estimate
  const estimatedCredits = calculateCreditsFromStructure(structure);

  // Check if structure has talking head scenes
  const hasTalkingHead =
    structure?.structure.scenes.some((s) => s.type === "talking_head") ?? false;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleAnalyze = useCallback(async () => {
    if (!url) return;

    setAnalysisProgress(0);
    setAnalysisStage("Downloading video...");

    // Simulate progress while the backend works
    const interval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev < 30) {
          setAnalysisStage("Downloading video...");
          return prev + 5;
        }
        if (prev < 70) {
          setAnalysisStage("Analyzing structure with AI...");
          return prev + 3;
        }
        if (prev < 90) {
          setAnalysisStage("Validating template structure...");
          return prev + 1;
        }
        return prev;
      });
    }, 500);

    try {
      const result = await analyzeMutation.mutateAsync({ url });
      clearInterval(interval);
      setAnalysisProgress(100);
      setAnalysisStage("Analysis complete!");

      // For now, simulate the template result
      // In production, we'd poll for the actual result
      if (result.jobId) {
        // Use the job ID as template ID placeholder until the analysis completes
        // In a real implementation, the worker would create the template and we'd poll
        setTemplateId(result.jobId);
        setTimeout(() => {
          setStep(2);
        }, 500);
      }
    } catch (error) {
      clearInterval(interval);
      setAnalysisProgress(0);
      setAnalysisStage("");
      console.error("Analysis failed:", error);
    }
  }, [url, analyzeMutation]);

  const handleGenerate = useCallback(async () => {
    if (!templateId || !selectedProductId || !selectedVoice) return;

    setIsGenerating(true);
    setGenerateProgress(10);

    const interval = setInterval(() => {
      setGenerateProgress((prev) => Math.min(prev + 15, 90));
    }, 800);

    try {
      if (variantCount > 1) {
        const variants = Array.from({ length: variantCount }, () => ({
          productId: selectedProductId,
          productUrl: productUrl || undefined,
          voiceId: selectedVoice,
          avatarId: selectedAvatar || undefined,
          brandKitId: brandKitId || undefined,
        }));

        await batchMutation.mutateAsync({
          templateId,
          variants,
        });
      } else {
        await generateMutation.mutateAsync({
          templateId,
          productId: selectedProductId,
          productUrl: productUrl || undefined,
          voiceId: selectedVoice,
          avatarId: selectedAvatar || undefined,
          brandKitId: brandKitId || undefined,
        });
      }

      clearInterval(interval);
      setGenerateProgress(100);
      setTimeout(() => router.push("/videos"), 1000);
    } catch {
      clearInterval(interval);
      setIsGenerating(false);
      setGenerateProgress(0);
    }
  }, [
    templateId,
    selectedProductId,
    selectedVoice,
    selectedAvatar,
    brandKitId,
    productUrl,
    variantCount,
    generateMutation,
    batchMutation,
    router,
  ]);

  const selectedProduct = productsQuery.data?.products.find(
    (p) => p.id === selectedProductId
  );

  // Use a demo structure if analysis hasn't completed yet
  const displayStructure: TemplateStructure = structure ?? {
    structure: {
      hook: { type: "question", duration_s: 2.5, text_overlay: true },
      scenes: [
        {
          type: "talking_head",
          duration_s: 3,
          emotion: "excited",
          gesture: "lean in",
          transition: "cut",
          text_overlay: false,
        },
        {
          type: "product_broll",
          duration_s: 4,
          emotion: "curious",
          gesture: "point",
          transition: "swipe",
          text_overlay: "Game changer",
        },
        {
          type: "talking_head",
          duration_s: 3,
          emotion: "genuine",
          gesture: "nod",
          transition: "cut",
          text_overlay: false,
        },
      ],
      cta: { type: "urgency", duration_s: 2.5, text_overlay: true },
    },
    style: {
      pacing: "fast",
      music_mood: "upbeat pop",
      caption_style: "bold centered",
      color_tone: "warm saturated",
    },
    format: { aspect: "9:16", total_duration_s: 15 },
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Clone Viral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a TikTok or Reel URL to deconstruct its viral structure, then
          generate your own version.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {[
          { n: 1, label: "Analyze" },
          { n: 2, label: "Structure" },
          { n: 3, label: "Customize" },
          { n: 4, label: "Generate" },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                n === step
                  ? "bg-[#7C3AED] text-white"
                  : n < step
                    ? "bg-[#7C3AED]/20 text-[#7C3AED]"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {n < step ? "\u2713" : n}
            </div>
            {n < 4 && (
              <div
                className={`h-0.5 w-6 sm:w-10 ${
                  n < step ? "bg-[#7C3AED]" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
        <span className="ml-4 text-sm text-muted-foreground">
          {step === 1 && "Paste URL"}
          {step === 2 && "Review Structure"}
          {step === 3 && "Customize"}
          {step === 4 && "Generate"}
        </span>
      </div>

      {/* ================================================================= */}
      {/* STEP 1: URL Input                                                  */}
      {/* ================================================================= */}
      {step === 1 && (
        <div className="space-y-6">
          <Card className="border-2 border-dashed border-[#7C3AED]/30">
            <CardHeader>
              <CardTitle>Paste a Viral Video URL</CardTitle>
              <CardDescription>
                We support TikTok, Instagram Reels, and YouTube Shorts. We will
                download the video and analyze its structure using AI.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  placeholder="https://www.tiktok.com/@user/video/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 text-base"
                  disabled={analyzeMutation.isPending}
                />
                <Button
                  onClick={handleAnalyze}
                  disabled={
                    !url || analyzeMutation.isPending || analysisProgress > 0
                  }
                  className="bg-[#7C3AED] px-8 hover:bg-[#7C3AED]/90"
                >
                  {analyzeMutation.isPending ? "Analyzing..." : "Analyze"}
                </Button>
              </div>

              {analysisProgress > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#7C3AED]">
                      {analysisStage}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {analysisProgress}%
                    </span>
                  </div>
                  <Progress value={analysisProgress} className="h-2" />
                  <div className="flex gap-4 pt-2">
                    {["Downloading video", "Analyzing with AI", "Validating"].map(
                      (label, i) => (
                        <div key={label} className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              analysisProgress > (i + 1) * 30
                                ? "bg-[#A3E635]"
                                : analysisProgress > i * 30
                                  ? "animate-pulse bg-[#7C3AED]"
                                  : "bg-muted"
                            }`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {label}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {analyzeMutation.error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-600">
                    {analyzeMutation.error.message}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                platform: "TikTok",
                icon: "TT",
                desc: "Paste any TikTok video URL",
              },
              {
                platform: "Instagram",
                icon: "IG",
                desc: "Paste a Reel or post URL",
              },
              {
                platform: "YouTube",
                icon: "YT",
                desc: "Paste a Shorts URL",
              },
            ].map(({ platform, icon, desc }) => (
              <Card key={platform} className="bg-muted/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#7C3AED]/10 text-sm font-bold text-[#7C3AED]">
                    {icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{platform}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 2: Analysis Result — Scene Timeline                           */}
      {/* ================================================================= */}
      {step === 2 && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main timeline */}
          <div className="space-y-4 lg:col-span-2">
            {/* Hook card */}
            <Card className="border-l-4 border-l-[#7C3AED]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#7C3AED] text-lg font-bold text-white">
                    {HOOK_TYPE_ICONS[displayStructure.structure.hook.type] ??
                      "H"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Hook</h3>
                      <Badge variant="outline" className="text-xs capitalize">
                        {displayStructure.structure.hook.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {displayStructure.structure.hook.duration_s}s
                      {displayStructure.structure.hook.text_overlay &&
                        " + text overlay"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div
                      className="h-2 rounded-full bg-[#7C3AED]"
                      style={{
                        width: `${Math.min(
                          (displayStructure.structure.hook.duration_s /
                            displayStructure.format.total_duration_s) *
                            200,
                          200
                        )}px`,
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {displayStructure.structure.hook.duration_s}s
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scene cards */}
            {displayStructure.structure.scenes.map((scene, index) => (
              <div key={index}>
                {/* Transition arrow */}
                <div className="flex items-center justify-center py-1">
                  <div className="flex flex-col items-center">
                    <div className="h-4 w-px bg-border" />
                    <span className="text-[10px] text-muted-foreground">
                      {scene.transition ?? "cut"}
                    </span>
                    <div className="h-4 w-px bg-border" />
                  </div>
                </div>

                <Card className="border-l-4 border-l-[#1E1B4B]/60">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E1B4B] text-xs font-bold text-white">
                        {SCENE_TYPE_ICONS[scene.type] ?? "SC"}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">
                            Scene {index + 1}
                          </h3>
                          <Badge
                            variant="outline"
                            className="text-xs capitalize"
                          >
                            {scene.type.replace("_", " ")}
                          </Badge>
                          {scene.emotion && (
                            <Badge
                              variant="secondary"
                              className="text-xs capitalize"
                            >
                              {scene.emotion}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          {scene.gesture && <span>Gesture: {scene.gesture}</span>}
                          {scene.text_overlay &&
                            scene.text_overlay !== false && (
                              <span>
                                Text:{" "}
                                {typeof scene.text_overlay === "string"
                                  ? `"${scene.text_overlay}"`
                                  : "Yes"}
                              </span>
                            )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="h-2 rounded-full bg-[#1E1B4B]/60"
                          style={{
                            width: `${Math.min(
                              (scene.duration_s /
                                displayStructure.format.total_duration_s) *
                                200,
                              200
                            )}px`,
                          }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {scene.duration_s}s
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}

            {/* CTA card */}
            <div className="flex items-center justify-center py-1">
              <div className="flex flex-col items-center">
                <div className="h-4 w-px bg-border" />
                <span className="text-[10px] text-muted-foreground">
                  transition
                </span>
                <div className="h-4 w-px bg-border" />
              </div>
            </div>

            <Card className="border-l-4 border-l-[#A3E635]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#A3E635] text-sm font-bold text-[#1E1B4B]">
                    CTA
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Call to Action</h3>
                      <Badge variant="outline" className="text-xs capitalize">
                        {CTA_TYPE_LABELS[
                          displayStructure.structure.cta.type
                        ] ?? displayStructure.structure.cta.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {displayStructure.structure.cta.duration_s}s
                      {displayStructure.structure.cta.text_overlay &&
                        " + text overlay"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div
                      className="h-2 rounded-full bg-[#A3E635]"
                      style={{
                        width: `${Math.min(
                          (displayStructure.structure.cta.duration_s /
                            displayStructure.format.total_duration_s) *
                            200,
                          200
                        )}px`,
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {displayStructure.structure.cta.duration_s}s
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar — Style info */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Style</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pacing</span>
                  <Badge
                    variant="outline"
                    className={`capitalize ${getPacingColor(displayStructure.style.pacing)}`}
                  >
                    {displayStructure.style.pacing}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Music</span>
                  <span className="text-sm font-medium capitalize">
                    {displayStructure.style.music_mood}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Captions
                  </span>
                  <span className="text-sm font-medium capitalize">
                    {displayStructure.style.caption_style}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Color Tone
                  </span>
                  <span className="text-sm font-medium capitalize">
                    {displayStructure.style.color_tone}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Format</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Aspect Ratio
                  </span>
                  <Badge variant="outline">
                    {displayStructure.format.aspect}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Total Duration
                  </span>
                  <span className="text-sm font-semibold">
                    {displayStructure.format.total_duration_s}s
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Scenes</span>
                  <span className="text-sm font-semibold">
                    {displayStructure.structure.scenes.length}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#7C3AED]/30 bg-[#7C3AED]/5">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Estimated Credits
                  </p>
                  <p className="text-2xl font-bold text-[#7C3AED]">
                    {calculateCreditsFromStructure(displayStructure)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 3: Customize                                                  */}
      {/* ================================================================= */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Product selector */}
          <Card>
            <CardHeader>
              <CardTitle>Select Product</CardTitle>
              <CardDescription>
                Choose an existing product or paste a URL to scrape a new one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={selectedProductId}
                onValueChange={(v) => {
                  setSelectedProductId(v);
                  setProductUrl("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a product..." />
                </SelectTrigger>
                <SelectContent>
                  {productsQuery.data?.products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                  {(!productsQuery.data ||
                    productsQuery.data.products.length === 0) && (
                    <SelectItem value="__none" disabled>
                      No products yet
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-sm text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="flex gap-3">
                <Input
                  placeholder="https://example.com/product/..."
                  value={productUrl}
                  onChange={(e) => {
                    setProductUrl(e.target.value);
                    setSelectedProductId("");
                  }}
                  className="flex-1"
                />
              </div>

              {selectedProduct && (
                <div className="rounded-lg border border-[#7C3AED]/30 bg-[#7C3AED]/5 p-4">
                  <h4 className="font-medium">{selectedProduct.name}</h4>
                  {selectedProduct.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {selectedProduct.description}
                    </p>
                  )}
                  {selectedProduct.price && (
                    <Badge variant="secondary" className="mt-2">
                      {selectedProduct.price}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Avatar selector (if structure has talking_head scenes) */}
          {hasTalkingHead && (
            <Card>
              <CardHeader>
                <CardTitle>Choose Avatar</CardTitle>
                <CardDescription>
                  Select the AI presenter for talking-head scenes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {PLACEHOLDER_AVATARS.map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar.id)}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all hover:border-[#7C3AED]/50 ${
                        selectedAvatar === avatar.id
                          ? "border-[#7C3AED] bg-[#7C3AED]/5"
                          : "border-transparent"
                      }`}
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#1E1B4B] to-[#7C3AED]/60 text-sm font-bold text-white">
                        {avatar.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium">{avatar.name}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Voice selector */}
          <Card>
            <CardHeader>
              <CardTitle>Choose Voice</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a voice..." />
                </SelectTrigger>
                <SelectContent>
                  {PLACEHOLDER_VOICES.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Scene script review */}
          <Card>
            <CardHeader>
              <CardTitle>Scene Scripts</CardTitle>
              <CardDescription>
                Review and edit the AI-generated script fitted to the template.
                Each scene is editable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Hook */}
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Badge className="bg-[#7C3AED]">Hook</Badge>
                  <span className="text-xs text-muted-foreground capitalize">
                    {displayStructure.structure.hook.type} -{" "}
                    {displayStructure.structure.hook.duration_s}s
                  </span>
                </div>
                <Textarea
                  value={sceneScripts[-1] ?? ""}
                  onChange={(e) =>
                    setSceneScripts((prev) => ({
                      ...prev,
                      [-1]: e.target.value,
                    }))
                  }
                  placeholder="AI will generate the hook script based on your product..."
                  rows={2}
                  className="text-sm"
                />
              </div>

              {/* Scenes */}
              {displayStructure.structure.scenes.map((scene, index) => (
                <div key={index} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {scene.type.replace("_", " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {scene.duration_s}s
                      {scene.emotion ? ` - ${scene.emotion}` : ""}
                    </span>
                  </div>
                  <Textarea
                    value={sceneScripts[index] ?? ""}
                    onChange={(e) =>
                      setSceneScripts((prev) => ({
                        ...prev,
                        [index]: e.target.value,
                      }))
                    }
                    placeholder={`AI will generate scene ${index + 1} script...`}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              ))}

              {/* CTA */}
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Badge className="bg-[#A3E635] text-[#1E1B4B]">CTA</Badge>
                  <span className="text-xs text-muted-foreground capitalize">
                    {displayStructure.structure.cta.type} -{" "}
                    {displayStructure.structure.cta.duration_s}s
                  </span>
                </div>
                <Textarea
                  value={sceneScripts[999] ?? ""}
                  onChange={(e) =>
                    setSceneScripts((prev) => ({
                      ...prev,
                      [999]: e.target.value,
                    }))
                  }
                  placeholder="AI will generate the CTA script..."
                  rows={2}
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand kit selector */}
          <Card>
            <CardHeader>
              <CardTitle>Brand Kit (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={brandKitId} onValueChange={setBrandKitId}>
                <SelectTrigger>
                  <SelectValue placeholder="No brand kit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No brand kit</SelectItem>
                  {brandKitsQuery.data?.map((kit) => (
                    <SelectItem key={kit.id} value={kit.id}>
                      {kit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Credit estimate */}
          <Card className="border-[#7C3AED]/30 bg-[#7C3AED]/5">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">Credit Estimate</p>
                <p className="text-xs text-muted-foreground">
                  Based on {displayStructure.structure.scenes.length} scenes (
                  {displayStructure.structure.scenes
                    .map((s) => s.type.replace("_", " "))
                    .join(", ")}
                  )
                </p>
              </div>
              <span className="text-2xl font-bold text-[#7C3AED]">
                {estimatedCredits} credits
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 4: Generate                                                   */}
      {/* ================================================================= */}
      {step === 4 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generation Summary</CardTitle>
              <CardDescription>
                Review your configuration before generating.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">
                    Template
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {displayStructure.structure.hook.type} hook
                    </Badge>
                    <span className="text-sm font-medium">
                      {displayStructure.structure.scenes.length} scenes,{" "}
                      {displayStructure.format.total_duration_s}s
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">
                    Product
                  </span>
                  <span className="text-sm font-medium">
                    {selectedProduct?.name || productUrl || "Not selected"}
                  </span>
                </div>
                {hasTalkingHead && (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm text-muted-foreground">
                      Avatar
                    </span>
                    <span className="text-sm font-medium">
                      {PLACEHOLDER_AVATARS.find((a) => a.id === selectedAvatar)
                        ?.name || "None"}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">Voice</span>
                  <span className="text-sm font-medium">
                    {PLACEHOLDER_VOICES.find((v) => v.id === selectedVoice)
                      ?.name || "None"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">
                    Brand Kit
                  </span>
                  <span className="text-sm font-medium">
                    {brandKitId && brandKitId !== "none"
                      ? brandKitsQuery.data?.find((k) => k.id === brandKitId)
                          ?.name || "Selected"
                      : "None"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">
                    Estimated Credits
                  </span>
                  <span className="text-sm font-semibold text-[#7C3AED]">
                    {estimatedCredits * variantCount} credits
                    {variantCount > 1 &&
                      ` (${estimatedCredits} x ${variantCount})`}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">
                    Your Balance
                  </span>
                  <span className="text-sm font-medium">
                    {creditsQuery.data?.balance ?? "..."} credits
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Variant count selector */}
          <Card>
            <CardHeader>
              <CardTitle>Batch Generation</CardTitle>
              <CardDescription>
                Generate multiple variants from the same template with different
                scripts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Label htmlFor="variant-count" className="text-sm">
                  Number of variants
                </Label>
                <Select
                  value={String(variantCount)}
                  onValueChange={(v) => setVariantCount(Number(v))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  = {estimatedCredits * variantCount} credits total
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Progress */}
          {isGenerating && (
            <Card className="border-[#7C3AED]/30">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {generateProgress < 100
                        ? `Generating ${variantCount > 1 ? `${variantCount} variants` : "video"}...`
                        : "Video queued successfully!"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {generateProgress}%
                    </span>
                  </div>
                  <Progress value={generateProgress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}

          {(generateMutation.error || batchMutation.error) && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="p-4">
                <p className="text-sm text-red-600">
                  {generateMutation.error?.message ||
                    batchMutation.error?.message}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* Navigation buttons                                                 */}
      {/* ================================================================= */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          Back
        </Button>
        <div className="flex gap-3">
          {step === 2 && (
            <Button
              onClick={() => setStep(3)}
              className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
            >
              Use This Structure
            </Button>
          )}
          {step === 3 && (
            <Button
              onClick={() => setStep(4)}
              disabled={!selectedVoice || (!selectedProductId && !productUrl)}
              className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
            >
              Continue
            </Button>
          )}
          {step === 4 && (
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setVariantCount(1);
                  handleGenerate();
                }}
                disabled={isGenerating}
                className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
              >
                {isGenerating ? "Generating..." : "Generate Video"}
              </Button>
              {variantCount > 1 && (
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  variant="outline"
                  className="border-[#7C3AED] text-[#7C3AED] hover:bg-[#7C3AED]/10"
                >
                  Generate Batch ({variantCount} variants)
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
