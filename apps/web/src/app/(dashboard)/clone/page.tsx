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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyzedScene {
  index: number;
  label: string;
  description: string;
  duration: string;
  type: string;
}

interface AnalysisResult {
  templateId: string;
  status: string;
  title: string;
  platform: string;
  engagementScore: number;
  hookAnalysis: {
    type: string;
    text: string;
    effectiveness: number;
  };
  pacing: {
    averageCutDuration: string;
    totalDuration: string;
    rhythm: string;
  };
  scenes: AnalyzedScene[];
  viralFactors: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLACEHOLDER_VOICES = [
  { id: "voice-1", name: "Confident Female" },
  { id: "voice-2", name: "Friendly Male" },
  { id: "voice-3", name: "Energetic Female" },
  { id: "voice-4", name: "Calm Male" },
  { id: "voice-5", name: "Professional Female" },
];

const STEP_LABELS = ["Paste URL", "Review Structure", "Customize & Generate"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTemplateToAnalysis(
  template: { id: string; sourceUrl: string | null; structure: any },
  url: string
): AnalysisResult {
  const struct = template.structure as Record<string, any>;
  const scenes: AnalyzedScene[] = (struct?.structure?.scenes ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any, i: number) => ({
      index: i + 1,
      label:
        s.type
          ?.replace(/_/g, " ")
          .replace(/\b\w/g, (c: string) => c.toUpperCase()) ??
        `Scene ${i + 1}`,
      description:
        [s.emotion, s.gesture].filter(Boolean).join(" — ") ||
        s.type ||
        "Scene",
      duration: `${s.duration_s ?? 0}s`,
      type: s.type ?? "unknown",
    })
  );

  const totalDuration = struct?.format?.total_duration_s ?? 0;

  return {
    templateId: template.id,
    status: "completed",
    title: "Viral Video Analysis",
    platform: url.includes("tiktok") ? "TikTok" : "Instagram",
    engagementScore: Math.round(Math.min(100, totalDuration * 4.5)),
    hookAnalysis: {
      type: struct?.structure?.hook?.type ?? "unknown",
      text: `Opens with a ${struct?.structure?.hook?.type ?? "unknown"} hook`,
      effectiveness: Math.min(95, 70 + scenes.length * 4),
    },
    pacing: {
      averageCutDuration:
        scenes.length > 0
          ? `${(scenes.reduce((sum, s) => sum + parseFloat(s.duration), 0) / scenes.length).toFixed(1)}s`
          : "--",
      totalDuration: `${totalDuration}s`,
      rhythm:
        struct?.style?.pacing === "fast"
          ? "Fast-paced with quick cuts"
          : struct?.style?.pacing === "slow"
            ? "Slow and deliberate"
            : "Natural flow with strategic pauses",
    },
    scenes,
    viralFactors: [
      `${struct?.structure?.hook?.type ?? "Question"} hook in opening`,
      `${struct?.style?.pacing ?? "Medium"} pacing throughout`,
      `${struct?.style?.music_mood ?? "Trending"} audio mood`,
      `${struct?.structure?.cta?.type ?? "Urgency"} CTA technique`,
      `${scenes.length} distinct scenes`,
    ],
  };
}

function getSceneTypeColor(type: string): string {
  switch (type) {
    case "hook":
      return "bg-red-500/10 text-red-700 border-red-200";
    case "problem":
      return "bg-amber-500/10 text-amber-700 border-amber-200";
    case "reveal":
      return "bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/20";
    case "demo":
      return "bg-blue-500/10 text-blue-700 border-blue-200";
    case "proof":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-200";
    case "cta":
      return "bg-orange-500/10 text-orange-700 border-orange-200";
    default:
      return "bg-muted text-muted-foreground";
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
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(
    null
  );

  // Step 3: Customize & Generate
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [brandKitId, setBrandKitId] = useState("");
  const [presetId, setPresetId] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);

  // Queries
  const productsQuery = trpc.product.list.useQuery({ limit: 50 });
  const brandKitsQuery = trpc.brandKit.list.useQuery();
  const creditsQuery = trpc.credits.getBalance.useQuery();
  const { data: presets } = trpc.preset.list.useQuery();

  // Poll for analysis completion
  const pollQuery = trpc.clone.pollAnalysis.useQuery(
    { sourceUrl: sourceUrl! },
    {
      enabled: !!sourceUrl && !analysisResult,
      refetchInterval: 3000,
    }
  );

  // Mutations
  const analyzeMutation = trpc.clone.analyzeUrl.useMutation();
  const generateMutation = trpc.clone.generateFromTemplate.useMutation();

  const selectedProduct = productsQuery.data?.products.find(
    (p) => p.id === selectedProductId
  );

  const estimatedCredits = 2;

  // -------------------------------------------------------------------------
  // URL validation
  // -------------------------------------------------------------------------

  const isValidUrl = useCallback((value: string) => {
    try {
      const parsed = new URL(value);
      return (
        parsed.hostname.includes("tiktok.com") ||
        parsed.hostname.includes("instagram.com") ||
        parsed.hostname.includes("instagr.am")
      );
    } catch {
      return false;
    }
  }, []);

  // -------------------------------------------------------------------------
  // When poll returns a completed template, map it to analysis result
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (
      pollQuery.data?.status === "completed" &&
      pollQuery.data.template &&
      sourceUrl &&
      !analysisResult
    ) {
      const mapped = mapTemplateToAnalysis(pollQuery.data.template, sourceUrl);
      setAnalysisResult(mapped);
      setAnalysisProgress(100);
      setAnalysisStage("Analysis complete!");
    }
  }, [pollQuery.data, sourceUrl, analysisResult]);

  // Timeout: stop polling after 120s
  useEffect(() => {
    if (sourceUrl && !analysisResult && analysisStartedAt) {
      const elapsed = Date.now() - analysisStartedAt;
      if (elapsed > 120_000) {
        setSourceUrl(null);
        setAnalysisProgress(0);
        setAnalysisStage("Analysis timed out. Please try again.");
      }
    }
  }, [pollQuery.dataUpdatedAt, sourceUrl, analysisResult, analysisStartedAt]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleAnalyze = useCallback(async () => {
    if (!isValidUrl(url)) return;

    setAnalysisProgress(0);
    setAnalysisStage("Downloading video metadata...");
    setAnalysisResult(null);
    setSourceUrl(null);
    setAnalysisStartedAt(null);

    const interval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev < 25) {
          setAnalysisStage("Downloading video...");
          return prev + 3;
        }
        if (prev < 50) {
          setAnalysisStage("Extracting scene structure and transitions...");
          return prev + 2;
        }
        if (prev < 75) {
          setAnalysisStage("Analyzing hook effectiveness and pacing...");
          return prev + 1;
        }
        if (prev < 90) {
          setAnalysisStage("Computing engagement score and viral factors...");
          return prev + 0.5;
        }
        return prev;
      });
    }, 800);

    try {
      const result = await analyzeMutation.mutateAsync({ url });
      // Job queued — start polling for template creation
      setSourceUrl(result.sourceUrl);
      setAnalysisStartedAt(Date.now());
    } catch {
      clearInterval(interval);
      setAnalysisProgress(0);
      setAnalysisStage("");
    }

    // Progress bar keeps running until poll finds the template
    // Clean up interval when analysis result arrives
    return () => clearInterval(interval);
  }, [url, isValidUrl, analyzeMutation]);

  // Auto-advance to step 2 when analysis completes
  useEffect(() => {
    if (analysisResult && step === 1 && analysisProgress === 100) {
      const timer = setTimeout(() => setStep(2), 600);
      return () => clearTimeout(timer);
    }
  }, [analysisResult, step, analysisProgress]);

  const handleGenerate = useCallback(async () => {
    if (!analysisResult || !selectedProductId || !selectedVoice) return;

    setIsGenerating(true);
    setGenerateProgress(10);

    const interval = setInterval(() => {
      setGenerateProgress((prev) => Math.min(prev + 12, 90));
    }, 700);

    try {
      await generateMutation.mutateAsync({
        templateId: analysisResult.templateId,
        productId: selectedProductId,
        voiceId: selectedVoice,
        brandKitId: brandKitId && brandKitId !== "none" ? brandKitId : undefined,
        presetId,
      });

      clearInterval(interval);
      setGenerateProgress(100);
      setTimeout(() => router.push("/videos"), 1000);
    } catch {
      clearInterval(interval);
      setIsGenerating(false);
      setGenerateProgress(0);
    }
  }, [
    analysisResult,
    selectedProductId,
    selectedVoice,
    brandKitId,
    presetId,
    generateMutation,
    router,
  ]);

  function canProceed(): boolean {
    switch (step) {
      case 1:
        return !!analysisResult;
      case 2:
        return !!analysisResult;
      case 3:
        return !!(selectedProductId && selectedVoice);
      default:
        return false;
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Clone Viral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a TikTok or Reel URL to deconstruct its viral structure, then
          generate your own version with your product.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                s === step
                  ? "bg-[#7C3AED] text-white"
                  : s < step
                    ? "bg-[#7C3AED]/20 text-[#7C3AED]"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? "\u2713" : s}
            </div>
            {s < 3 && (
              <div
                className={`h-0.5 w-8 sm:w-12 ${
                  s < step ? "bg-[#7C3AED]" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
        <span className="ml-4 text-sm text-muted-foreground">
          {STEP_LABELS[step - 1]}
        </span>
      </div>

      {/* ================================================================= */}
      {/* STEP 1: Paste URL                                                  */}
      {/* ================================================================= */}
      {step === 1 && (
        <div className="space-y-6">
          <Card className="border-2 border-dashed border-[#7C3AED]/30">
            <CardHeader>
              <CardTitle>Paste a Viral Video URL</CardTitle>
              <CardDescription>
                Enter a TikTok or Instagram Reel URL and we will analyze its
                viral structure, pacing, hooks, and engagement patterns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  placeholder="https://www.tiktok.com/@user/video/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1"
                  disabled={analyzeMutation.isPending}
                />
                <Button
                  onClick={handleAnalyze}
                  disabled={
                    !isValidUrl(url) ||
                    analyzeMutation.isPending ||
                    analysisProgress > 0
                  }
                  className="bg-[#7C3AED] px-6 hover:bg-[#7C3AED]/90"
                >
                  {analyzeMutation.isPending ? "Analyzing..." : "Analyze"}
                </Button>
              </div>

              {url && !isValidUrl(url) && url.length > 10 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Please enter a valid TikTok or Instagram URL.
                </p>
              )}

              {/* Analysis progress */}
              {analysisProgress > 0 && !analysisResult && (
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
                  <div className="space-y-2 pt-1">
                    {[
                      { label: "Downloading video metadata", threshold: 10 },
                      {
                        label: "Extracting scene structure and transitions",
                        threshold: 30,
                      },
                      {
                        label: "Analyzing hook effectiveness and pacing",
                        threshold: 55,
                      },
                      {
                        label: "Computing engagement score and viral factors",
                        threshold: 80,
                      },
                    ].map(({ label, threshold }) => (
                      <div key={label} className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            analysisProgress >= threshold + 15
                              ? "bg-[#7C3AED]"
                              : analysisProgress >= threshold
                                ? "animate-pulse bg-[#7C3AED]"
                                : "bg-muted"
                          }`}
                        />
                        <span
                          className={`text-xs ${
                            analysisProgress >= threshold
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Analysis complete confirmation */}
              {analysisResult && (
                <div className="mt-6 flex items-center gap-3 rounded-lg border border-[#7C3AED]/30 bg-[#7C3AED]/5 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED]/20">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[#7C3AED]"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Analysis complete</p>
                    <p className="text-xs text-muted-foreground">
                      Found {analysisResult.scenes.length} scenes with an
                      engagement score of {analysisResult.engagementScore}/100
                    </p>
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

          {/* Supported platforms */}
          <div className="grid gap-4 sm:grid-cols-2">
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
      {/* STEP 2: Review Structure                                           */}
      {/* ================================================================= */}
      {step === 2 && analysisResult && (
        <div className="space-y-6">
          {/* Overview metrics */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Platform
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {analysisResult.platform}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Duration
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {analysisResult.pacing.totalDuration}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Engagement Score
                </p>
                <p className="mt-1 text-lg font-semibold text-[#7C3AED]">
                  {analysisResult.engagementScore}/100
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Hook Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Hook Analysis</CardTitle>
              <CardDescription>
                How the video captures attention in the first seconds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-[#7C3AED]/20 bg-[#7C3AED]/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge className="bg-[#7C3AED]">
                      {analysisResult.hookAnalysis.type}
                    </Badge>
                    <p className="mt-2 text-sm">
                      {analysisResult.hookAnalysis.text}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#7C3AED]">
                      {analysisResult.hookAnalysis.effectiveness}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Effectiveness
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pacing */}
          <Card>
            <CardHeader>
              <CardTitle>Pacing Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Avg. Cut</p>
                  <p className="text-sm font-semibold">
                    {analysisResult.pacing.averageCutDuration}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total Length</p>
                  <p className="text-sm font-semibold">
                    {analysisResult.pacing.totalDuration}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Rhythm</p>
                  <p className="text-sm font-semibold">
                    {analysisResult.pacing.rhythm}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scene Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Scene Breakdown</CardTitle>
              <CardDescription>
                Deconstructed scene-by-scene structure of the viral video.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysisResult.scenes.map((scene) => (
                  <div
                    key={scene.index}
                    className="flex items-center gap-4 rounded-lg border p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED]/10 text-sm font-semibold text-[#7C3AED]">
                      {scene.index}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{scene.label}</p>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${getSceneTypeColor(scene.type)}`}
                        >
                          {scene.type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {scene.description}
                      </p>
                    </div>
                    <Badge variant="outline">{scene.duration}</Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted p-3">
                <span className="text-sm font-medium">Total duration</span>
                <span className="text-sm font-semibold">
                  {analysisResult.pacing.totalDuration}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Viral Factors */}
          <Card>
            <CardHeader>
              <CardTitle>Viral Factors</CardTitle>
              <CardDescription>
                Key elements that contribute to this video&apos;s virality.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysisResult.viralFactors.map((factor, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-emerald-600"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </div>
                    <span className="text-sm">{factor}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 3: Customize & Generate                                       */}
      {/* ================================================================= */}
      {step === 3 && analysisResult && (
        <div className="space-y-6">
          {/* Product Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Product</CardTitle>
              <CardDescription>
                Choose a product from your catalog to feature in the cloned
                video.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedProductId}
                onValueChange={(v) => setSelectedProductId(v ?? "")}
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

              {selectedProduct && (
                <Card className="mt-4 border-[#7C3AED]/30 bg-[#7C3AED]/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-sm font-medium text-muted-foreground">
                        PKG
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{selectedProduct.name}</h3>
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
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Voice Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Choose Voice</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedVoice} onValueChange={(v) => setSelectedVoice(v ?? "")}>
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

          {/* Brand Kit */}
          <Card>
            <CardHeader>
              <CardTitle>Brand Kit (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={brandKitId} onValueChange={(v) => setBrandKitId(v ?? "")}>
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

          {/* Preset Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Visual Style</CardTitle>
              <CardDescription>
                Choose a visual style preset for your cloned video.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* Generation Summary */}
          <Card className="border-[#7C3AED]/30 bg-[#7C3AED]/5">
            <CardHeader>
              <CardTitle>Generation Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                  <span className="text-sm text-muted-foreground">
                    Source Video
                  </span>
                  <Badge variant="outline">{analysisResult.platform}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                  <span className="text-sm text-muted-foreground">
                    Template Scenes
                  </span>
                  <span className="text-sm font-medium">
                    {analysisResult.scenes.length} scenes
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                  <span className="text-sm text-muted-foreground">Product</span>
                  <span className="text-sm font-medium">
                    {selectedProduct?.name || "Not selected"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                  <span className="text-sm text-muted-foreground">Voice</span>
                  <span className="text-sm font-medium">
                    {PLACEHOLDER_VOICES.find((v) => v.id === selectedVoice)
                      ?.name || "None"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                  <span className="text-sm text-muted-foreground">
                    Estimated Credits
                  </span>
                  <span className="text-sm font-semibold text-[#7C3AED]">
                    {estimatedCredits} credits
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-background p-3">
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

          {/* Generation progress */}
          {isGenerating && (
            <Card className="border-[#7C3AED]/30">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {generateProgress < 100
                        ? "Generating your cloned video..."
                        : "Video queued successfully!"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {generateProgress}%
                    </span>
                  </div>
                  <Progress value={generateProgress} className="h-2" />
                  {generateProgress < 100 && (
                    <p className="text-xs text-muted-foreground">
                      Your video is being generated using the viral template.
                      You will be redirected to the videos page.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error state */}
          {generateMutation.error && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="p-4">
                <p className="text-sm text-red-600">
                  {generateMutation.error.message}
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
          {step === 1 && (
            <Button
              onClick={() => setStep(2)}
              disabled={!canProceed()}
              className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
            >
              Continue
            </Button>
          )}
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
              onClick={handleGenerate}
              disabled={isGenerating || !canProceed()}
              className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
            >
              {isGenerating ? "Generating..." : "Generate Cloned Video"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
