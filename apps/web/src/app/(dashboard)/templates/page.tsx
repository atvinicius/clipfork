"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

const HOOK_TYPE_COLORS: Record<string, string> = {
  question: "from-blue-600 to-blue-400",
  story: "from-amber-600 to-amber-400",
  shock: "from-red-600 to-red-400",
  statistic: "from-emerald-600 to-emerald-400",
};

const SCENE_TYPE_ICONS: Record<string, string> = {
  talking_head: "TH",
  product_broll: "BR",
  text_overlay: "TX",
  testimonial: "TM",
  greenscreen: "GS",
};

const PLATFORM_LABELS: Record<string, { label: string; badge: string }> = {
  TIKTOK: { label: "TikTok", badge: "TT" },
  INSTAGRAM: { label: "Instagram", badge: "IG" },
  YOUTUBE: { label: "YouTube", badge: "YT" },
};

const CTA_TYPE_LABELS: Record<string, string> = {
  urgency: "Urgency",
  scarcity: "Scarcity",
  social_proof: "Social Proof",
};

const CATEGORIES = ["question", "story", "shock", "statistic"];

const INDUSTRIES = [
  "Beauty",
  "Fashion",
  "Tech",
  "Food",
  "Fitness",
  "Home",
  "Finance",
  "Education",
  "Health",
  "Entertainment",
];

const PACING_OPTIONS = ["slow", "medium", "fast"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHookColor(hookType: string): string {
  return HOOK_TYPE_COLORS[hookType] ?? "from-[#7C3AED] to-[#7C3AED]/60";
}

function getPacingBadge(pacing: string): string {
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

function extractStructure(raw: unknown): TemplateStructure | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.structure && obj.style && obj.format) {
    return raw as TemplateStructure;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-0">
            <div className="h-32 bg-muted" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StructureTimeline({
  structure,
}: {
  structure: TemplateStructure;
}) {
  return (
    <div className="space-y-3">
      {/* Hook */}
      <div className="flex items-center gap-3 rounded-lg border border-[#7C3AED]/30 bg-[#7C3AED]/5 p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-[#7C3AED] text-xs font-bold text-white">
          H
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Hook</span>
            <Badge variant="outline" className="text-xs capitalize">
              {structure.structure.hook.type}
            </Badge>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {structure.structure.hook.duration_s}s
        </span>
      </div>

      {/* Scenes */}
      {structure.structure.scenes.map((scene, i) => (
        <div key={i}>
          <div className="flex justify-center py-0.5">
            <div className="h-3 w-px bg-border" />
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#1E1B4B] text-xs font-bold text-white">
              {SCENE_TYPE_ICONS[scene.type] ?? "SC"}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Scene {i + 1}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {scene.type.replace("_", " ")}
                </Badge>
                {scene.emotion && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {scene.emotion}
                  </Badge>
                )}
              </div>
              {scene.gesture && (
                <span className="text-xs text-muted-foreground">
                  {scene.gesture}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {scene.duration_s}s
            </span>
          </div>
        </div>
      ))}

      {/* CTA */}
      <div className="flex justify-center py-0.5">
        <div className="h-3 w-px bg-border" />
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-[#A3E635]/30 bg-[#A3E635]/5 p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-[#A3E635] text-xs font-bold text-[#1E1B4B]">
          CT
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">CTA</span>
            <Badge variant="outline" className="text-xs capitalize">
              {CTA_TYPE_LABELS[structure.structure.cta.type] ??
                structure.structure.cta.type}
            </Badge>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {structure.structure.cta.duration_s}s
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function TemplatesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("platform");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [pacingFilter, setPacingFilter] = useState("");
  const [minScenesFilter, setMinScenesFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Queries
  const publicTemplatesQuery = trpc.template.listPublic.useQuery({
    category: categoryFilter && categoryFilter !== "all" ? categoryFilter : undefined,
    industry: industryFilter && industryFilter !== "all" ? industryFilter : undefined,
    pacing:
      pacingFilter && pacingFilter !== "all"
        ? (pacingFilter as "slow" | "medium" | "fast")
        : undefined,
    minScenes:
      minScenesFilter && minScenesFilter !== "all"
        ? Number(minScenesFilter)
        : undefined,
    search: searchQuery || undefined,
    limit: 50,
  });

  const myTemplatesQuery = trpc.template.listMine.useQuery({ limit: 50 });

  const selectedTemplateQuery = trpc.template.getById.useQuery(
    { id: selectedTemplateId! },
    { enabled: !!selectedTemplateId }
  );

  const saveTemplateMutation = trpc.template.save.useMutation({
    onSuccess: () => {
      myTemplatesQuery.refetch();
    },
  });

  const deleteTemplateMutation = trpc.template.delete.useMutation({
    onSuccess: () => {
      setSelectedTemplateId(null);
      myTemplatesQuery.refetch();
    },
  });

  const templates =
    activeTab === "platform"
      ? publicTemplatesQuery.data?.templates ?? []
      : myTemplatesQuery.data?.templates ?? [];

  const isLoading =
    activeTab === "platform"
      ? publicTemplatesQuery.isLoading
      : myTemplatesQuery.isLoading;

  // Parse structure for the selected template
  const selectedStructure = selectedTemplateQuery.data
    ? extractStructure(selectedTemplateQuery.data.structure)
    : null;

  // -------------------------------------------------------------------------
  // Render template card
  // -------------------------------------------------------------------------

  function renderTemplateCard(template: {
    id: string;
    category: string | null;
    industry: string[];
    sourcePlatform: string | null;
    engagementScore: number | null;
    structure: unknown;
  }) {
    const parsed = extractStructure(template.structure);
    const hookType = parsed?.structure?.hook?.type ?? "question";
    const sceneCount = parsed?.structure?.scenes?.length ?? 0;
    const totalDuration = parsed?.format?.total_duration_s ?? 0;
    const pacing = parsed?.style?.pacing ?? "medium";

    return (
      <Card
        key={template.id}
        className="cursor-pointer overflow-hidden transition-all hover:shadow-md hover:border-[#7C3AED]/50"
        onClick={() => setSelectedTemplateId(template.id)}
      >
        <CardContent className="p-0">
          {/* Color-coded thumbnail by hook type */}
          <div
            className={`flex h-32 items-center justify-center bg-gradient-to-br ${getHookColor(hookType)}`}
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-white/90 capitalize">
                {hookType}
              </div>
              <p className="mt-1 text-sm text-white/70">
                {sceneCount} scenes | {totalDuration}s
              </p>
            </div>
          </div>

          <div className="p-4">
            {/* Platform and pacing badges */}
            <div className="flex items-center gap-2">
              {template.sourcePlatform &&
                PLATFORM_LABELS[template.sourcePlatform] && (
                  <Badge variant="outline" className="text-xs font-semibold">
                    {PLATFORM_LABELS[template.sourcePlatform].badge}
                  </Badge>
                )}
              <Badge
                variant="outline"
                className={`text-xs capitalize ${getPacingBadge(pacing)}`}
              >
                {pacing}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {sceneCount} scenes
              </Badge>
            </div>

            {/* Category and industry tags */}
            <div className="mt-2 flex flex-wrap gap-1">
              {template.category && (
                <Badge
                  variant="outline"
                  className="text-xs capitalize border-[#7C3AED]/30 text-[#7C3AED]"
                >
                  {template.category}
                </Badge>
              )}
              {template.industry.slice(0, 2).map((ind) => (
                <Badge key={ind} variant="secondary" className="text-xs">
                  {ind}
                </Badge>
              ))}
              {template.industry.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{template.industry.length - 2}
                </Badge>
              )}
            </div>

            {/* Engagement score bar */}
            {template.engagementScore !== null &&
              template.engagementScore > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Engagement</span>
                    <span className="font-medium">
                      {Math.round(template.engagementScore * 100)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[#A3E635]"
                      style={{
                        width: `${Math.min(template.engagementScore * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse viral templates or manage your saved structures.
          </p>
        </div>
        <Button
          className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
          onClick={() => router.push("/clone")}
        >
          + Clone New Video
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="platform">Platform Templates</TabsTrigger>
          <TabsTrigger value="mine">My Templates</TabsTrigger>
        </TabsList>

        {/* ============================================================= */}
        {/* Platform Templates Tab                                         */}
        {/* ============================================================= */}
        <TabsContent value="platform" className="mt-0">
          <div className="mb-6 mt-4 space-y-3">
            {/* Search bar */}
            <Input
              placeholder="Search templates by keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />

            {/* Filter row */}
            <div className="flex flex-wrap gap-3">
              <Select
                value={categoryFilter}
                onValueChange={(v) => setCategoryFilter(v ?? "all")}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={industryFilter}
                onValueChange={(v) => setIndustryFilter(v ?? "all")}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={pacingFilter}
                onValueChange={(v) => setPacingFilter(v ?? "all")}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Pacing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pacing</SelectItem>
                  {PACING_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={minScenesFilter}
                onValueChange={(v) => setMinScenesFilter(v ?? "all")}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Min scenes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Scenes</SelectItem>
                  {[2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}+ scenes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(categoryFilter ||
                industryFilter ||
                pacingFilter ||
                minScenesFilter ||
                searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCategoryFilter("");
                    setIndustryFilter("");
                    setPacingFilter("");
                    setMinScenesFilter("");
                    setSearchQuery("");
                  }}
                  className="text-xs"
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {/* Template grid */}
          {isLoading ? (
            <SkeletonGrid />
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-12">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#7C3AED]/10 text-2xl font-bold text-[#7C3AED]">
                  T
                </div>
                <h3 className="text-lg font-medium">No templates found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  No public templates match your filters. Try adjusting your
                  search.
                </p>
                <Button
                  className="mt-4 bg-[#7C3AED] hover:bg-[#7C3AED]/90"
                  onClick={() => router.push("/clone")}
                >
                  Clone a Video
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) =>
                renderTemplateCard({
                  id: template.id,
                  category: template.category,
                  industry: template.industry,
                  sourcePlatform: template.sourcePlatform,
                  engagementScore: template.engagementScore,
                  structure: template.structure,
                })
              )}
            </div>
          )}
        </TabsContent>

        {/* ============================================================= */}
        {/* My Templates Tab                                               */}
        {/* ============================================================= */}
        <TabsContent value="mine" className="mt-4">
          {myTemplatesQuery.isLoading ? (
            <SkeletonGrid />
          ) : (myTemplatesQuery.data?.templates ?? []).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-12">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#7C3AED]/10 text-2xl font-bold text-[#7C3AED]">
                  T
                </div>
                <h3 className="text-lg font-medium">No saved templates</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Clone a viral video or save a platform template to get
                  started.
                </p>
                <Button
                  className="mt-4 bg-[#7C3AED] hover:bg-[#7C3AED]/90"
                  onClick={() => router.push("/clone")}
                >
                  Clone a Video
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(myTemplatesQuery.data?.templates ?? []).map((template) =>
                renderTemplateCard({
                  id: template.id,
                  category: template.category,
                  industry: template.industry,
                  sourcePlatform: template.sourcePlatform,
                  engagementScore: template.engagementScore,
                  structure: template.structure,
                })
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ================================================================= */}
      {/* Template Detail Slide-out Dialog                                   */}
      {/* ================================================================= */}
      <Dialog
        open={!!selectedTemplateId}
        onOpenChange={(open) => {
          if (!open) setSelectedTemplateId(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Details</DialogTitle>
            <DialogDescription>
              {selectedTemplateQuery.data?.sourceUrl
                ? `Source: ${selectedTemplateQuery.data.sourceUrl}`
                : "View the full structure of this template"}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplateQuery.isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : selectedStructure ? (
            <div className="space-y-6">
              {/* Meta badges */}
              <div className="flex flex-wrap gap-2">
                {selectedTemplateQuery.data?.sourcePlatform &&
                  PLATFORM_LABELS[
                    selectedTemplateQuery.data.sourcePlatform
                  ] && (
                    <Badge variant="outline" className="font-semibold">
                      {
                        PLATFORM_LABELS[
                          selectedTemplateQuery.data.sourcePlatform
                        ].label
                      }
                    </Badge>
                  )}
                <Badge
                  variant="outline"
                  className={`capitalize ${getPacingBadge(selectedStructure.style.pacing)}`}
                >
                  {selectedStructure.style.pacing} pacing
                </Badge>
                <Badge variant="secondary">
                  {selectedStructure.format.aspect}
                </Badge>
                <Badge variant="secondary">
                  {selectedStructure.format.total_duration_s}s
                </Badge>
                {selectedTemplateQuery.data?.category && (
                  <Badge
                    variant="outline"
                    className="capitalize border-[#7C3AED]/30 text-[#7C3AED]"
                  >
                    {selectedTemplateQuery.data.category}
                  </Badge>
                )}
              </div>

              {/* Style info grid */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Style</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded border p-2">
                      <p className="text-xs text-muted-foreground">Music</p>
                      <p className="text-sm font-medium capitalize">
                        {selectedStructure.style.music_mood}
                      </p>
                    </div>
                    <div className="rounded border p-2">
                      <p className="text-xs text-muted-foreground">Captions</p>
                      <p className="text-sm font-medium capitalize">
                        {selectedStructure.style.caption_style}
                      </p>
                    </div>
                    <div className="rounded border p-2">
                      <p className="text-xs text-muted-foreground">
                        Color Tone
                      </p>
                      <p className="text-sm font-medium capitalize">
                        {selectedStructure.style.color_tone}
                      </p>
                    </div>
                    <div className="rounded border p-2">
                      <p className="text-xs text-muted-foreground">Pacing</p>
                      <p className="text-sm font-medium capitalize">
                        {selectedStructure.style.pacing}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Full structure timeline (read-only) */}
              <div>
                <h3 className="mb-3 text-sm font-semibold">Scene Timeline</h3>
                <StructureTimeline structure={selectedStructure} />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-[#7C3AED] hover:bg-[#7C3AED]/90"
                  onClick={() => {
                    const id = selectedTemplateQuery.data?.id;
                    setSelectedTemplateId(null);
                    router.push(`/clone?templateId=${id}`);
                  }}
                >
                  Use This Template
                </Button>

                {activeTab === "platform" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selectedTemplateQuery.data) {
                        saveTemplateMutation.mutate({
                          sourceTemplateId: selectedTemplateQuery.data.id,
                          structure:
                            selectedTemplateQuery.data.structure as Record<
                              string,
                              unknown
                            >,
                        });
                      }
                    }}
                    disabled={saveTemplateMutation.isPending}
                  >
                    {saveTemplateMutation.isPending
                      ? "Saving..."
                      : "Save to My Templates"}
                  </Button>
                )}

                {activeTab === "mine" && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (selectedTemplateId) {
                        deleteTemplateMutation.mutate({
                          id: selectedTemplateId,
                        });
                      }
                    }}
                    disabled={deleteTemplateMutation.isPending}
                  >
                    {deleteTemplateMutation.isPending
                      ? "Deleting..."
                      : "Delete"}
                  </Button>
                )}
              </div>

              {saveTemplateMutation.isSuccess && (
                <div className="rounded-lg border border-[#A3E635]/30 bg-[#A3E635]/5 p-3">
                  <p className="text-sm text-[#1E1B4B]">
                    Template saved to your library!
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
