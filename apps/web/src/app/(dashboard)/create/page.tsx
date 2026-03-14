"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type VideoType = "VOICEOVER" | "FACELESS";

const PLACEHOLDER_VOICES = [
  { id: "voice-1", name: "Confident Female" },
  { id: "voice-2", name: "Friendly Male" },
  { id: "voice-3", name: "Energetic Female" },
  { id: "voice-4", name: "Calm Male" },
  { id: "voice-5", name: "Professional Female" },
];

export default function CreateVideoPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [productUrl, setProductUrl] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [videoType, setVideoType] = useState<VideoType | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [script, setScript] = useState(
    "Hey everyone! I just tried this amazing product and I have to tell you about it...\n\nThe quality is incredible, and the price point is perfect for anyone looking to upgrade their routine.\n\nSeriously, if you haven't tried this yet, you're missing out. Link in bio!"
  );
  const [brandKitId, setBrandKitId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const productsQuery = trpc.product.list.useQuery({ limit: 50 });
  const brandKitsQuery = trpc.brandKit.list.useQuery();
  const creditsQuery = trpc.credits.getBalance.useQuery();
  const createVideoMutation = trpc.video.create.useMutation();

  const selectedProduct = productsQuery.data?.products.find(
    (p) => p.id === selectedProductId
  );

  const estimatedCredits = 1;

  function handleNext() {
    if (step < 4) setStep(step + 1);
  }

  function handleBack() {
    if (step > 1) setStep(step - 1);
  }

  function canProceed() {
    switch (step) {
      case 1:
        return selectedProductId || productUrl;
      case 2:
        return videoType && selectedVoice;
      case 3:
        return script.trim().length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  }

  async function handleGenerate() {
    if (!videoType) return;
    setIsGenerating(true);
    setGenerationProgress(10);

    const interval = setInterval(() => {
      setGenerationProgress((prev) => Math.min(prev + 15, 90));
    }, 800);

    try {
      await createVideoMutation.mutateAsync({
        productId: selectedProductId || undefined,
        productUrl: productUrl || undefined,
        videoType: videoType === "VOICEOVER" ? "TALKING_HEAD" : "FACELESS",
        brandKitId: brandKitId || undefined,
        voiceId: selectedVoice || undefined,
      });
      setGenerationProgress(100);
      clearInterval(interval);
      setTimeout(() => router.push("/videos"), 1000);
    } catch {
      clearInterval(interval);
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Create Video</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate UGC videos from a product URL or your catalog.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
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
            {s < 4 && (
              <div
                className={`h-0.5 w-8 sm:w-12 ${
                  s < step ? "bg-[#7C3AED]" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
        <span className="ml-4 text-sm text-muted-foreground">
          {step === 1 && "Product"}
          {step === 2 && "Format & Voice"}
          {step === 3 && "Script Review"}
          {step === 4 && "Generate"}
        </span>
      </div>

      {/* Step 1: Product */}
      {step === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add a Product URL</CardTitle>
              <CardDescription>
                Paste a product link and we will scrape the details automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                <Button
                  variant="outline"
                  disabled={!productUrl}
                  onClick={() => {
                    // TODO: trigger product scraping
                  }}
                >
                  Scrape
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Select Existing Product</CardTitle>
              <CardDescription>
                Choose a product from your catalog.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedProductId}
                onValueChange={(v) => {
                  setSelectedProductId(v ?? "");
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
                  {(!productsQuery.data || productsQuery.data.products.length === 0) && (
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
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-2xl">
                        📦
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
        </div>
      )}

      {/* Step 2: Format & Voice */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card
              className={`cursor-pointer transition-all hover:border-[#7C3AED]/50 ${
                videoType === "VOICEOVER"
                  ? "border-[#7C3AED] ring-2 ring-[#7C3AED]/20"
                  : ""
              }`}
              onClick={() => setVideoType("VOICEOVER")}
            >
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#7C3AED]/10 text-4xl">
                  🎙️
                </div>
                <h3 className="text-lg font-semibold">Voiceover</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Product footage with AI voiceover narration, text overlays,
                  and trending music.
                </p>
                <Badge className="mt-3 bg-[#7C3AED]">1 credit</Badge>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all hover:border-[#7C3AED]/50 ${
                videoType === "FACELESS"
                  ? "border-[#7C3AED] ring-2 ring-[#7C3AED]/20"
                  : ""
              }`}
              onClick={() => setVideoType("FACELESS")}
            >
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#7C3AED]/10 text-4xl">
                  🎬
                </div>
                <h3 className="text-lg font-semibold">Faceless</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Product B-roll with captions, text overlays, and
                  transitions. No voice needed.
                </p>
                <Badge className="mt-3 bg-[#7C3AED]">1 credit</Badge>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Choose Voice</CardTitle>
              <CardDescription>
                Select an AI voice for narration{videoType === "FACELESS" ? " (optional for faceless)" : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedVoice}
                onValueChange={(v) => setSelectedVoice(v ?? "")}
              >
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
        </div>
      )}

      {/* Step 3: Script Review */}
      {step === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Review & Edit Script</CardTitle>
              <CardDescription>
                This AI-generated script will be used for your video. Feel free to
                customize it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scene Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { scene: "Hook", duration: "3s", desc: "Attention-grabbing opener" },
                  { scene: "Problem", duration: "4s", desc: "Pain point identification" },
                  { scene: "Solution", duration: "5s", desc: "Product showcase" },
                  { scene: "CTA", duration: "3s", desc: "Call to action" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-lg border p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED]/10 text-sm font-semibold text-[#7C3AED]">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.scene}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                    <Badge variant="outline">{item.duration}</Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted p-3">
                <span className="text-sm font-medium">Estimated total</span>
                <span className="text-sm font-semibold">~15 seconds</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 4: Generate */}
      {step === 4 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generation Summary</CardTitle>
              <CardDescription>
                Review your video configuration before generating.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">Product</span>
                  <span className="text-sm font-medium">
                    {selectedProduct?.name || productUrl || "Not selected"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">Format</span>
                  <Badge className="bg-[#7C3AED]">
                    {videoType === "VOICEOVER" ? "Voiceover" : "Faceless"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">Voice</span>
                  <span className="text-sm font-medium">
                    {PLACEHOLDER_VOICES.find((v) => v.id === selectedVoice)
                      ?.name || "None"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">
                    Estimated Credits
                  </span>
                  <span className="text-sm font-semibold text-[#7C3AED]">
                    {estimatedCredits} credits
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

          {isGenerating && (
            <Card className="border-[#7C3AED]/30">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {generationProgress < 100
                        ? "Generating your video..."
                        : "Video queued successfully!"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {generationProgress}%
                    </span>
                  </div>
                  <Progress value={generationProgress} className="h-2" />
                  {generationProgress < 100 && (
                    <p className="text-xs text-muted-foreground">
                      Your video is being queued for generation. You will be
                      redirected to the videos page.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {createVideoMutation.error && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="p-4">
                <p className="text-sm text-red-600">
                  {createVideoMutation.error.message}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 1}
        >
          Back
        </Button>
        <div className="flex gap-3">
          {step < 4 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !canProceed()}
              className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
            >
              {isGenerating ? "Generating..." : "Generate Video"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
