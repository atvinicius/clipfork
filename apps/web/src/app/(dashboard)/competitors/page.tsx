"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type WatchType = "ACCOUNT" | "HASHTAG" | "KEYWORD";
type Platform = "TIKTOK" | "INSTAGRAM";
type ScanFrequency = "DAILY" | "TWICE_DAILY" | "WEEKLY";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WATCH_TYPE_LABELS: Record<WatchType, string> = {
  ACCOUNT: "Account",
  HASHTAG: "Hashtag",
  KEYWORD: "Keyword",
};

const WATCH_TYPE_COLORS: Record<WatchType, string> = {
  ACCOUNT: "bg-blue-100 text-blue-700 border-blue-200",
  HASHTAG: "bg-purple-100 text-purple-700 border-purple-200",
  KEYWORD: "bg-amber-100 text-amber-700 border-amber-200",
};

const PLATFORM_LABELS: Record<Platform, string> = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
};

const PLATFORM_COLORS: Record<Platform, string> = {
  TIKTOK: "bg-pink-100 text-pink-700 border-pink-200",
  INSTAGRAM: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
};

const FREQUENCY_LABELS: Record<ScanFrequency, string> = {
  DAILY: "Daily",
  TWICE_DAILY: "Twice Daily",
  WEEKLY: "Weekly",
};

const VALUE_PLACEHOLDERS: Record<WatchType, string> = {
  ACCOUNT: "@competitor_handle",
  HASHTAG: "#trending_tag",
  KEYWORD: "search keyword",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CompetitorsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Add watch form state
  const [watchType, setWatchType] = useState<WatchType>("ACCOUNT");
  const [platform, setPlatform] = useState<Platform>("TIKTOK");
  const [value, setValue] = useState("");
  const [frequency, setFrequency] = useState<ScanFrequency>("DAILY");

  // ---- Queries ----
  const watchesQuery = trpc.competitor.listWatches.useQuery();
  const outliersQuery = trpc.competitor.getOutliers.useQuery({ limit: 20 });

  // ---- Mutations ----
  const createWatch = trpc.competitor.createWatch.useMutation({
    onSuccess: () => {
      setDialogOpen(false);
      resetForm();
      watchesQuery.refetch();
    },
  });

  const toggleWatch = trpc.competitor.toggleWatch.useMutation({
    onSuccess: () => watchesQuery.refetch(),
  });

  const deleteWatch = trpc.competitor.deleteWatch.useMutation({
    onSuccess: () => watchesQuery.refetch(),
  });

  const triggerScan = trpc.competitor.triggerScan.useMutation({
    onSuccess: () => watchesQuery.refetch(),
  });

  const clonePost = trpc.competitor.clonePost.useMutation({
    onSuccess: () => {
      window.location.href = "/clone";
    },
  });

  // ---- Helpers ----
  function resetForm() {
    setWatchType("ACCOUNT");
    setPlatform("TIKTOK");
    setValue("");
    setFrequency("DAILY");
  }

  function handleCreate() {
    if (!value.trim()) return;
    createWatch.mutate({
      type: watchType,
      platform,
      value: value.trim(),
      frequency,
    });
  }

  const watches = watchesQuery.data ?? [];
  const outliers = outliersQuery.data ?? [];

  // ---- Render ----
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Competitor Intel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor competitor accounts and discover viral outliers.
          </p>
        </div>
        <Button
          className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
          onClick={() => setDialogOpen(true)}
        >
          + Add Watch
        </Button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Active Watches                                                     */}
      {/* ----------------------------------------------------------------- */}

      {watchesQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="space-y-3 p-5">
                <div className="h-5 w-1/2 rounded bg-muted" />
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-4 w-1/3 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : watches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <div className="mb-4 text-5xl">🔍</div>
            <h3 className="text-lg font-medium">No watches yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Start monitoring competitors to discover viral content.
            </p>
            <Button
              className="mt-4 bg-[#7C3AED] hover:bg-[#7C3AED]/90"
              onClick={() => setDialogOpen(true)}
            >
              Add Your First Watch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {watches.map((watch) => (
            <Card
              key={watch.id}
              className={`transition-shadow hover:shadow-md ${
                !watch.active ? "opacity-50" : ""
              }`}
            >
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={WATCH_TYPE_COLORS[watch.type as WatchType]}
                  >
                    {WATCH_TYPE_LABELS[watch.type as WatchType] ?? watch.type}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={PLATFORM_COLORS[watch.platform as Platform]}
                  >
                    {PLATFORM_LABELS[watch.platform as Platform] ??
                      watch.platform}
                  </Badge>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {FREQUENCY_LABELS[watch.frequency as ScanFrequency] ??
                      watch.frequency}
                  </Badge>
                </div>
                <CardTitle className="mt-2 text-lg">{watch.value}</CardTitle>
              </CardHeader>

              <CardContent>
                {/* Stats row */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {watch.postCount ?? 0} post
                    {(watch.postCount ?? 0) !== 1 ? "s" : ""} tracked
                  </span>
                  <span>
                    {watch.lastScannedAt
                      ? formatDate(watch.lastScannedAt)
                      : "Never scanned"}
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => triggerScan.mutate({ id: watch.id })}
                    disabled={triggerScan.isPending}
                  >
                    {triggerScan.isPending ? "Scanning..." : "Scan Now"}
                  </Button>

                  {/* Toggle active / inactive */}
                  <button
                    type="button"
                    aria-label={watch.active ? "Pause watch" : "Resume watch"}
                    onClick={() =>
                      toggleWatch.mutate({
                        id: watch.id,
                        active: !watch.active,
                      })
                    }
                    disabled={toggleWatch.isPending}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
                      watch.active ? "bg-[#7C3AED]" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        watch.active ? "translate-x-[18px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>

                  <Button
                    variant="destructive"
                    size="sm"
                    className="ml-auto"
                    onClick={() => deleteWatch.mutate({ id: watch.id })}
                    disabled={deleteWatch.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Viral Outliers                                                     */}
      {/* ----------------------------------------------------------------- */}

      <div className="mt-10">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Viral Outliers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Top-performing posts discovered across all your watches.
          </p>
        </div>

        {outliersQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="space-y-3 p-5">
                  <div className="h-32 rounded bg-muted" />
                  <div className="h-4 w-1/2 rounded bg-muted" />
                  <div className="h-4 w-3/4 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : outliers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12">
              <div className="mb-4 text-5xl">🚀</div>
              <h3 className="text-lg font-medium">No outliers yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Outliers will appear here once your watches collect enough data.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {outliers.map((post) => (
              <Card
                key={post.id}
                className="overflow-hidden transition-shadow hover:shadow-md"
              >
                <CardContent className="p-0">
                  {/* Thumbnail / preview */}
                  <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-[#1E1B4B] to-[#7C3AED]/60">
                    {post.thumbnailUrl ? (
                      <img
                        src={post.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl text-white/60">▶</span>
                    )}
                    <Badge
                      variant="outline"
                      className={`absolute top-2 right-2 ${
                        PLATFORM_COLORS[post.platform as Platform]
                      }`}
                    >
                      {PLATFORM_LABELS[post.platform as Platform] ??
                        post.platform}
                    </Badge>
                  </div>

                  <div className="p-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-muted p-2 text-center">
                        <p className="text-xs text-muted-foreground">Views</p>
                        <p className="font-semibold">
                          {formatNumber(post.views ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted p-2 text-center">
                        <p className="text-xs text-muted-foreground">Likes</p>
                        <p className="font-semibold">
                          {formatNumber(post.likes ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted p-2 text-center">
                        <p className="text-xs text-muted-foreground">Shares</p>
                        <p className="font-semibold">
                          {formatNumber(post.shares ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted p-2 text-center">
                        <p className="text-xs text-muted-foreground">
                          Engagement
                        </p>
                        <p className="font-semibold text-[#7C3AED]">
                          {post.engagementRate != null
                            ? `${post.engagementRate.toFixed(1)}%`
                            : "--"}
                        </p>
                      </div>
                    </div>

                    {post.caption && (
                      <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                        {post.caption}
                      </p>
                    )}

                    {/* Clone */}
                    <Button
                      className="mt-3 w-full bg-[#7C3AED] hover:bg-[#7C3AED]/90"
                      size="sm"
                      onClick={() => clonePost.mutate({ postId: post.id })}
                      disabled={clonePost.isPending}
                    >
                      {clonePost.isPending ? "Cloning..." : "Clone"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Add Watch Dialog                                                   */}
      {/* ----------------------------------------------------------------- */}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Watch</DialogTitle>
            <DialogDescription>
              Monitor a competitor account, hashtag, or keyword for viral
              content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Watch Type */}
            <div className="space-y-2">
              <Label>Watch Type</Label>
              <Select
                value={watchType}
                onValueChange={(v) => setWatchType((v ?? "ACCOUNT") as WatchType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACCOUNT">Account</SelectItem>
                  <SelectItem value="HASHTAG">Hashtag</SelectItem>
                  <SelectItem value="KEYWORD">Keyword</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Platform */}
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={platform}
                onValueChange={(v) => setPlatform((v ?? "TIKTOK") as Platform)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TIKTOK">TikTok</SelectItem>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Value */}
            <div className="space-y-2">
              <Label>
                {watchType === "ACCOUNT"
                  ? "Username"
                  : watchType === "HASHTAG"
                    ? "Hashtag"
                    : "Keyword"}
              </Label>
              <Input
                placeholder={VALUE_PLACEHOLDERS[watchType]}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>

            {/* Scan Frequency */}
            <div className="space-y-2">
              <Label>Scan Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(v) => setFrequency((v ?? "DAILY") as ScanFrequency)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="TWICE_DAILY">Twice Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
              onClick={handleCreate}
              disabled={!value.trim() || createWatch.isPending}
            >
              {createWatch.isPending ? "Adding..." : "Add Watch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
