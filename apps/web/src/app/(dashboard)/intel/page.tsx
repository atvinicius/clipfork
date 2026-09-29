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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Types + formatting
// ---------------------------------------------------------------------------

type TargetType = "ACCOUNT" | "HASHTAG" | "SOUND" | "KEYWORD";
type Platform = "TIKTOK" | "INSTAGRAM";

const PLATFORM_COLORS: Record<string, string> = {
  TIKTOK: "bg-pink-100 text-pink-700 border-pink-200",
  INSTAGRAM: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
};

const SIGNAL_LABELS: Record<string, string> = {
  VIRAL_POST: "Viral Post",
  RISING_SOUND: "Rising Sound",
  CREATOR_BREAKOUT: "Creator Breakout",
  HASHTAG_TREND: "Hashtag Trend",
};

const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  ACCOUNT: "Account",
  HASHTAG: "Hashtag",
  SOUND: "Sound",
  KEYWORD: "Keyword",
};

const VALUE_PLACEHOLDERS: Record<TargetType, string> = {
  ACCOUNT: "@handle",
  HASHTAG: "#tag",
  SOUND: "sound URL or ID",
  KEYWORD: "search term",
};

function formatNumber(n: number | bigint | null | undefined): string {
  const v = Number(n ?? 0);
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFreq(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntelPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("TIKTOK");
  const [targetType, setTargetType] = useState<TargetType>("ACCOUNT");
  const [value, setValue] = useState("");
  const [freqMinutes, setFreqMinutes] = useState("360");
  const [downloadPolicy, setDownloadPolicy] = useState<"NONE" | "TOP_K" | "VIRAL_ONLY" | "ALL">("VIRAL_ONLY");

  const [feedPlatform, setFeedPlatform] = useState<Platform | "ALL">("ALL");
  const [feedSort, setFeedSort] = useState<"VIRALITY" | "VELOCITY" | "VIEWS" | "RECENT">("VIRALITY");

  const overview = trpc.intel.overview.useQuery();
  const targets = trpc.intel.listTargets.useQuery();
  const feed = trpc.intel.feedPosts.useQuery({
    platform: feedPlatform === "ALL" ? undefined : feedPlatform,
    sort: feedSort,
    limit: 30,
  });
  const sounds = trpc.intel.trendingSounds.useQuery({
    platform: feedPlatform === "ALL" ? undefined : feedPlatform,
    limit: 30,
  });
  const creators = trpc.intel.topCreators.useQuery({
    platform: feedPlatform === "ALL" ? undefined : feedPlatform,
    limit: 30,
  });
  const signals = trpc.intel.listSignals.useQuery({
    platform: feedPlatform === "ALL" ? undefined : feedPlatform,
    limit: 50,
  });

  const utils = trpc.useUtils();
  const createTarget = trpc.intel.createTarget.useMutation({
    onSuccess: () => {
      setDialogOpen(false);
      setValue("");
      utils.intel.listTargets.invalidate();
    },
  });
  const updateTarget = trpc.intel.updateTarget.useMutation({
    onSuccess: () => utils.intel.listTargets.invalidate(),
  });
  const runNow = trpc.intel.runTargetNow.useMutation();
  const deleteTarget = trpc.intel.deleteTarget.useMutation({
    onSuccess: () => utils.intel.listTargets.invalidate(),
  });
  const enqueueDownload = trpc.intel.enqueueDownload.useMutation();

  function handleCreate() {
    if (!value.trim()) return;
    createTarget.mutate({
      type: targetType,
      platform,
      value,
      crawlFrequencyMinutes: Number(freqMinutes),
      downloadPolicy,
    });
  }

  const ov = overview.data;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform-wide TikTok and Instagram corpus — collection targets, trends, and signals.
          </p>
        </div>
        <Button
          className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
          onClick={() => setDialogOpen(true)}
        >
          + Add Target
        </Button>
      </div>

      {/* Overview cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {[
          { label: "Posts", value: ov?.posts },
          { label: "Creators", value: ov?.creators },
          { label: "Sounds", value: ov?.sounds },
          { label: "New (24h)", value: ov?.newPosts24h },
          { label: "Active Signals", value: ov?.activeSignals },
          { label: "Active Targets", value: ov?.targets },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold">{formatNumber(s.value ?? 0)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Feed controls */}
      <div className="mb-4 flex items-center gap-3">
        <Select
          value={feedPlatform}
          onValueChange={(v) => setFeedPlatform((v ?? "ALL") as Platform | "ALL")}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All platforms</SelectItem>
            <SelectItem value="TIKTOK">TikTok</SelectItem>
            <SelectItem value="INSTAGRAM">Instagram</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={feedSort}
          onValueChange={(v) => setFeedSort((v ?? "VIRALITY") as typeof feedSort)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="VIRALITY">Virality</SelectItem>
            <SelectItem value="VELOCITY">Velocity</SelectItem>
            <SelectItem value="VIEWS">Views</SelectItem>
            <SelectItem value="RECENT">Recent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts">Viral Posts</TabsTrigger>
          <TabsTrigger value="sounds">Sounds</TabsTrigger>
          <TabsTrigger value="creators">Creators</TabsTrigger>
          <TabsTrigger value="signals">Signals</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
        </TabsList>

        {/* Posts feed */}
        <TabsContent value="posts">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Sound</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Views/hr</TableHead>
                    <TableHead className="text-right">Eng %</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(feed.data?.posts ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-[260px]">
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-sm text-[#7C3AED] hover:underline"
                        >
                          {p.caption || p.url}
                        </a>
                        <div className="mt-1 flex gap-1">
                          <Badge variant="outline" className={`text-[10px] ${PLATFORM_COLORS[p.platform]}`}>
                            {p.platform === "TIKTOK" ? "TT" : "IG"}
                          </Badge>
                          {p.isOutlier && (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700">
                              outlier
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">
                            {p.mediaStatus.toLowerCase()}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.creator ? `@${p.creator.username}` : "—"}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm">
                        {p.sound?.title ?? p.sound?.platformSoundId ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(p.views)}</TableCell>
                      <TableCell className="text-right">{formatNumber(Math.round(p.velocityPerHour))}</TableCell>
                      <TableCell className="text-right">{p.engagementRate.toFixed(1)}</TableCell>
                      <TableCell className="text-right font-semibold text-[#7C3AED]">
                        {p.viralityScore.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={p.mediaStatus === "READY" || p.mediaStatus === "DOWNLOADING" || enqueueDownload.isPending}
                          onClick={() => enqueueDownload.mutate({ postId: p.id })}
                        >
                          {p.mediaStatus === "READY" ? "Saved" : "Fetch"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {feed.data?.posts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        No posts yet — add a collection target to start the corpus.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trending sounds */}
        <TabsContent value="sounds">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sound</TableHead>
                    <TableHead>Artist</TableHead>
                    <TableHead className="text-right">Posts (window)</TableHead>
                    <TableHead className="text-right">Velocity</TableHead>
                    <TableHead className="text-right">Avg Eng %</TableHead>
                    <TableHead className="text-right">Platform Uses</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(sounds.data ?? []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="max-w-[220px]">
                        <span className="block truncate font-medium">
                          {s.title ?? `sound ${s.platformSoundId}`}
                        </span>
                        <div className="mt-1 flex gap-1">
                          <Badge variant="outline" className={`text-[10px] ${PLATFORM_COLORS[s.platform]}`}>
                            {s.platform === "TIKTOK" ? "TT" : "IG"}
                          </Badge>
                          {s.isOriginalAudio && (
                            <Badge variant="secondary" className="text-[10px]">original</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{s.artist ?? "—"}</TableCell>
                      <TableCell className="text-right">{s.postsN}</TableCell>
                      <TableCell className="text-right">{formatNumber(Math.round(s.velocity))}</TableCell>
                      <TableCell className="text-right">{s.avgEngagement.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{formatNumber(s.usageCount)}</TableCell>
                      <TableCell>
                        {s.externalUrl ? (
                          <a
                            href={s.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-[#7C3AED] hover:underline"
                          >
                            link
                          </a>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {sounds.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        No sound data yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Creators */}
        <TabsContent value="creators">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead className="text-right">Followers</TableHead>
                    <TableHead className="text-right">Gained (7d)</TableHead>
                    <TableHead className="text-right">Median Views</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(creators.data ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <span className="font-medium">@{c.username}</span>
                        {c.verified && <span className="ml-1 text-[#7C3AED]">✓</span>}
                        <Badge variant="outline" className={`ml-2 text-[10px] ${PLATFORM_COLORS[c.platform]}`}>
                          {c.platform === "TIKTOK" ? "TT" : "IG"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(c.followers)}</TableCell>
                      <TableCell className="text-right">
                        {c.gained7d != null ? `+${formatNumber(c.gained7d)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(c.medianViews)}</TableCell>
                    </TableRow>
                  ))}
                  {creators.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                        No creators tracked yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signals */}
        <TabsContent value="signals">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Signal</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Last seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(signals.data ?? []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Badge variant="outline" className="border-[#7C3AED]/30 bg-[#7C3AED]/5 text-[#7C3AED]">
                          {SIGNAL_LABELS[s.type] ?? s.type}
                        </Badge>
                        <Badge variant="outline" className={`ml-2 text-[10px] ${PLATFORM_COLORS[s.platform]}`}>
                          {s.platform === "TIKTOK" ? "TT" : "IG"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm">
                        {s.type === "VIRAL_POST" && s.post
                          ? s.post.caption || s.post.url
                          : s.type === "RISING_SOUND" && s.sound
                            ? `${s.sound.title ?? s.sound.platformSoundId}${s.sound.artist ? ` — ${s.sound.artist}` : ""}`
                            : s.type === "CREATOR_BREAKOUT" && s.creator
                              ? `@${s.creator.username}`
                              : s.hashtag
                                ? `#${s.hashtag}`
                                : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{s.score.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(s.lastSeenAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {signals.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                        Signals appear as the engine detects trends.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Targets */}
        <TabsContent value="targets">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target</TableHead>
                    <TableHead>Every</TableHead>
                    <TableHead>Downloads</TableHead>
                    <TableHead className="text-right">Posts</TableHead>
                    <TableHead className="text-right">Last crawl</TableHead>
                    <TableHead className="text-right">Next</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(targets.data ?? []).map((t) => (
                    <TableRow key={t.id} className={t.isActive ? "" : "opacity-50"}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{TARGET_TYPE_LABELS[t.type as TargetType]}</Badge>
                          <Badge variant="outline" className={`text-[10px] ${PLATFORM_COLORS[t.platform]}`}>
                            {t.platform === "TIKTOK" ? "TT" : "IG"}
                          </Badge>
                          <span className="font-medium">{t.value}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatFreq(t.crawlFrequencyMinutes)}</TableCell>
                      <TableCell className="text-sm">{t.downloadPolicy}</TableCell>
                      <TableCell className="text-right">{t._count.posts}</TableCell>
                      <TableCell className="text-right text-sm">{formatDate(t.lastCrawledAt)}</TableCell>
                      <TableCell className="text-right text-sm">{formatDate(t.nextCrawlAt)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Button
                          variant="outline" size="sm"
                          disabled={runNow.isPending}
                          onClick={() => runNow.mutate({ id: t.id })}
                        >
                          Run now
                        </Button>
                        <Button
                          variant="outline" size="sm" className="ml-2"
                          disabled={updateTarget.isPending}
                          onClick={() => updateTarget.mutate({ id: t.id, isActive: !t.isActive })}
                        >
                          {t.isActive ? "Pause" : "Resume"}
                        </Button>
                        <Button
                          variant="destructive" size="sm" className="ml-2"
                          disabled={deleteTarget.isPending}
                          onClick={() => deleteTarget.mutate({ id: t.id })}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {targets.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        No collection targets yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add target dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Collection Target</DialogTitle>
            <DialogDescription>
              Continuously collect posts for an account, hashtag, sound, or keyword.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={targetType} onValueChange={(v) => setTargetType((v ?? "ACCOUNT") as TargetType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACCOUNT">Account</SelectItem>
                    <SelectItem value="HASHTAG">Hashtag</SelectItem>
                    <SelectItem value="SOUND">Sound</SelectItem>
                    <SelectItem value="KEYWORD">Keyword</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={platform} onValueChange={(v) => setPlatform((v ?? "TIKTOK") as Platform)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TIKTOK">TikTok</SelectItem>
                    <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                placeholder={VALUE_PLACEHOLDERS[targetType]}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Crawl every</Label>
                <Select value={freqMinutes} onValueChange={(v) => setFreqMinutes(v ?? "360")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="360">6 hours</SelectItem>
                    <SelectItem value="720">12 hours</SelectItem>
                    <SelectItem value="1440">24 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Media downloads</Label>
                <Select
                  value={downloadPolicy}
                  onValueChange={(v) => setDownloadPolicy((v ?? "VIRAL_ONLY") as typeof downloadPolicy)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIRAL_ONLY">Viral only</SelectItem>
                    <SelectItem value="TOP_K">Top K per crawl</SelectItem>
                    <SelectItem value="ALL">All posts</SelectItem>
                    <SelectItem value="NONE">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
              onClick={handleCreate}
              disabled={!value.trim() || createTarget.isPending}
            >
              {createTarget.isPending ? "Adding..." : "Add Target"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
