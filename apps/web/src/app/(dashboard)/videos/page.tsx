"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StatusFilter = "ALL" | "COMPLETED" | "PROCESSING" | "FAILED";

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "bg-gray-100 text-gray-700 border-gray-200",
  SCRAPING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  SCRIPTING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  GENERATING_AUDIO: "bg-yellow-100 text-yellow-700 border-yellow-200",
  GENERATING_SCENES: "bg-yellow-100 text-yellow-700 border-yellow-200",
  COMPOSING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  COMPLETED: "bg-green-100 text-green-700 border-green-200",
  FAILED: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  SCRAPING: "Scraping",
  SCRIPTING: "Scripting",
  GENERATING_AUDIO: "Audio",
  GENERATING_SCENES: "Scenes",
  COMPOSING: "Composing",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

function isProcessingStatus(status: string) {
  return [
    "SCRAPING",
    "SCRIPTING",
    "GENERATING_AUDIO",
    "GENERATING_SCENES",
    "COMPOSING",
  ].includes(status);
}

export default function VideosPage() {
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [publishDialogVideoId, setPublishDialogVideoId] = useState<
    string | null
  >(null);
  const [scheduleDialogVideoId, setScheduleDialogVideoId] = useState<
    string | null
  >(null);

  // Publish form state
  const [publishAccountId, setPublishAccountId] = useState("");
  const [publishCaption, setPublishCaption] = useState("");
  const [publishHashtags, setPublishHashtags] = useState("");

  // Schedule form state
  const [scheduleAccountId, setScheduleAccountId] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleCaption, setScheduleCaption] = useState("");
  const [scheduleHashtags, setScheduleHashtags] = useState("");

  const statusParam = (() => {
    if (filter === "COMPLETED") return "COMPLETED" as const;
    if (filter === "FAILED") return "FAILED" as const;
    return undefined;
  })();

  const videosQuery = trpc.video.list.useQuery({
    limit: 50,
    status: statusParam,
  });

  const selectedVideoQuery = trpc.video.getById.useQuery(
    { id: selectedVideoId! },
    { enabled: !!selectedVideoId }
  );

  const tiktokAccountsQuery = trpc.tiktok.list.useQuery();

  const deleteVideoMutation = trpc.video.delete.useMutation({
    onSuccess: () => {
      setSelectedVideoId(null);
      videosQuery.refetch();
    },
  });

  const publishMutation = trpc.tiktok.publish.useMutation({
    onSuccess: () => {
      setPublishDialogVideoId(null);
      resetPublishForm();
      videosQuery.refetch();
    },
  });

  const scheduleMutation = trpc.tiktok.schedule.useMutation({
    onSuccess: () => {
      setScheduleDialogVideoId(null);
      resetScheduleForm();
      videosQuery.refetch();
    },
  });

  function resetPublishForm() {
    setPublishAccountId("");
    setPublishCaption("");
    setPublishHashtags("");
  }

  function resetScheduleForm() {
    setScheduleAccountId("");
    setScheduleDate("");
    setScheduleTime("");
    setScheduleCaption("");
    setScheduleHashtags("");
  }

  const filteredVideos = (() => {
    const videos = videosQuery.data?.videos ?? [];
    if (filter === "PROCESSING") {
      return videos.filter(
        (v) => isProcessingStatus(v.status) || v.status === "QUEUED"
      );
    }
    return videos;
  })();

  const activeAccounts = (tiktokAccountsQuery.data ?? []).filter(
    (a) => a.isActive
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Videos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View, download, publish, and manage your generated videos.
          </p>
        </div>
        <Button
          className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
          onClick={() => (window.location.href = "/create")}
        >
          + Create Video
        </Button>
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as StatusFilter)}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="ALL">All</TabsTrigger>
          <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          <TabsTrigger value="PROCESSING">Processing</TabsTrigger>
          <TabsTrigger value="FAILED">Failed</TabsTrigger>
        </TabsList>
      </Tabs>

      {videosQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-0">
                <div className="h-40 bg-muted" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <div className="mb-4 text-5xl">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted-foreground"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="m10 8 6 4-6 4V8Z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium">No videos yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first video to get started.
            </p>
            <Button
              className="mt-4 bg-[#7C3AED] hover:bg-[#7C3AED]/90"
              onClick={() => (window.location.href = "/create")}
            >
              Create Video
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVideos.map((video) => (
            <Card
              key={video.id}
              className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
              onClick={() => setSelectedVideoId(video.id)}
            >
              <CardContent className="p-0">
                {/* Thumbnail */}
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
                  {video.duration && (
                    <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                      {Math.round(video.duration)}s
                    </span>
                  )}
                  {/* Published indicator */}
                  {video.publishedAt && (
                    <Badge className="absolute top-2 right-2 bg-[#A3E635] text-[#1E1B4B]">
                      Published
                    </Badge>
                  )}
                  {/* Scheduled indicator */}
                  {!video.publishedAt && video.scheduledPublishAt && (
                    <Badge className="absolute top-2 right-2 bg-blue-500 text-white">
                      Scheduled
                    </Badge>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="truncate text-sm font-medium">
                    {video.product?.name || "Untitled Video"}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[video.status]}
                    >
                      {STATUS_LABELS[video.status]}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {video.type === "TALKING_HEAD"
                        ? "Talking Head"
                        : video.type === "FACELESS"
                          ? "Faceless"
                          : "Cloned"}
                    </Badge>
                  </div>

                  {/* Published link */}
                  {video.publishedUrl && (
                    <a
                      href={video.publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block truncate text-xs text-[#7C3AED] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on TikTok
                    </a>
                  )}

                  {/* Scheduled date */}
                  {!video.publishedAt &&
                    video.scheduledPublishAt && (
                      <p className="mt-2 text-xs text-blue-600">
                        Scheduled:{" "}
                        {new Date(
                          video.scheduledPublishAt
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}

                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{video.creditsUsed} credits</span>
                    <span>
                      {new Date(video.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Action buttons for completed videos */}
                  {video.status === "COMPLETED" && !video.publishedAt && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-[#7C3AED] hover:bg-[#7C3AED]/90"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPublishDialogVideoId(video.id);
                        }}
                      >
                        Publish
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setScheduleDialogVideoId(video.id);
                        }}
                      >
                        Schedule
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Video detail dialog */}
      <Dialog
        open={!!selectedVideoId}
        onOpenChange={(open) => {
          if (!open) setSelectedVideoId(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedVideoQuery.data?.product?.name || "Video Details"}
            </DialogTitle>
            <DialogDescription>
              Created on{" "}
              {selectedVideoQuery.data
                ? new Date(
                    selectedVideoQuery.data.createdAt
                  ).toLocaleDateString()
                : "..."}
            </DialogDescription>
          </DialogHeader>

          {selectedVideoQuery.isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : selectedVideoQuery.data ? (
            <div className="space-y-4">
              {/* Video player */}
              <div className="flex h-64 items-center justify-center rounded-lg bg-gradient-to-br from-[#1E1B4B] to-[#7C3AED]/60">
                {selectedVideoQuery.data.finalVideoUrl ? (
                  <video
                    src={selectedVideoQuery.data.finalVideoUrl}
                    controls
                    className="h-full w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="text-center">
                    <span className="text-4xl">
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        opacity="0.7"
                      >
                        <rect width="18" height="18" x="3" y="3" rx="2" />
                        <path d="m10 8 6 4-6 4V8Z" />
                      </svg>
                    </span>
                    <p className="mt-2 text-sm text-white/70">
                      {selectedVideoQuery.data.status === "COMPLETED"
                        ? "Video ready"
                        : "Video is being generated..."}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={`mt-1 ${STATUS_COLORS[selectedVideoQuery.data.status]}`}
                  >
                    {STATUS_LABELS[selectedVideoQuery.data.status]}
                  </Badge>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedVideoQuery.data.type === "TALKING_HEAD"
                      ? "Talking Head"
                      : selectedVideoQuery.data.type === "FACELESS"
                        ? "Faceless"
                        : "Cloned"}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Credits Used</p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedVideoQuery.data.creditsUsed}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedVideoQuery.data.duration
                      ? `${Math.round(selectedVideoQuery.data.duration)}s`
                      : "--"}
                  </p>
                </div>
              </div>

              {/* Scene thumbnails */}
              {selectedVideoQuery.data.sceneImages &&
                (selectedVideoQuery.data.sceneImages as string[]).length >
                  0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Scenes
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {(
                        selectedVideoQuery.data.sceneImages as string[]
                      ).map((imgUrl, i) => (
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

              {/* Published status */}
              {selectedVideoQuery.data.publishedAt && (
                <div className="rounded-lg border border-[#A3E635]/50 bg-[#A3E635]/10 p-3">
                  <p className="text-xs font-medium text-green-700">
                    Published
                  </p>
                  <p className="mt-1 text-sm">
                    {new Date(
                      selectedVideoQuery.data.publishedAt
                    ).toLocaleString()}
                    {selectedVideoQuery.data.publishedUrl && (
                      <a
                        href={selectedVideoQuery.data.publishedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-[#7C3AED] hover:underline"
                      >
                        View on TikTok
                      </a>
                    )}
                  </p>
                </div>
              )}

              {/* Scheduled status */}
              {!selectedVideoQuery.data.publishedAt &&
                selectedVideoQuery.data.scheduledPublishAt && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs font-medium text-blue-700">
                      Scheduled
                    </p>
                    <p className="mt-1 text-sm text-blue-600">
                      {new Date(
                        selectedVideoQuery.data.scheduledPublishAt
                      ).toLocaleString()}
                    </p>
                  </div>
                )}

              {selectedVideoQuery.data.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-medium text-red-700">Error</p>
                  <p className="mt-1 text-sm text-red-600">
                    {selectedVideoQuery.data.error}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {selectedVideoQuery.data.finalVideoUrl && (
                  <a
                    href={selectedVideoQuery.data.finalVideoUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white bg-[#7C3AED] hover:bg-[#7C3AED]/90 transition-colors"
                  >
                    Download
                  </a>
                )}
                {selectedVideoQuery.data.status === "COMPLETED" &&
                  !selectedVideoQuery.data.publishedAt && (
                    <>
                      <Button
                        className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
                        onClick={() => {
                          setSelectedVideoId(null);
                          setPublishDialogVideoId(
                            selectedVideoQuery.data!.id
                          );
                        }}
                      >
                        Publish to TikTok
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedVideoId(null);
                          setScheduleDialogVideoId(
                            selectedVideoQuery.data!.id
                          );
                        }}
                      >
                        Schedule
                      </Button>
                    </>
                  )}
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (selectedVideoId) {
                      deleteVideoMutation.mutate({ id: selectedVideoId });
                    }
                  }}
                  disabled={deleteVideoMutation.isPending}
                >
                  {deleteVideoMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog
        open={!!publishDialogVideoId}
        onOpenChange={(open) => {
          if (!open) {
            setPublishDialogVideoId(null);
            resetPublishForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish to TikTok</DialogTitle>
            <DialogDescription>
              Select an account and add a caption for your video.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>TikTok Account</Label>
              {activeAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No TikTok accounts connected.{" "}
                  <a
                    href="/accounts"
                    className="text-[#7C3AED] hover:underline"
                  >
                    Connect one
                  </a>
                </p>
              ) : (
                <Select
                  value={publishAccountId}
                  onValueChange={(v) => setPublishAccountId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        @{account.handle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Caption</Label>
              <Input
                placeholder="Write a caption for your video..."
                value={publishCaption}
                onChange={(e) => setPublishCaption(e.target.value)}
                maxLength={150}
              />
              <p className="text-xs text-muted-foreground">
                {publishCaption.length}/150 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label>Hashtags</Label>
              <Input
                placeholder="#viral #fyp #product (comma separated)"
                value={publishHashtags}
                onChange={(e) => setPublishHashtags(e.target.value)}
              />
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <p className="text-xs text-yellow-700">
                Video will be posted as &quot;Self Only&quot; for your review.
                Change visibility in TikTok after posting.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
              disabled={
                !publishAccountId ||
                publishMutation.isPending ||
                !publishDialogVideoId
              }
              onClick={() => {
                if (!publishDialogVideoId || !publishAccountId) return;
                publishMutation.mutate({
                  videoId: publishDialogVideoId,
                  tiktokAccountId: publishAccountId,
                  caption: publishCaption || undefined,
                  hashtags: publishHashtags
                    ? publishHashtags
                        .split(",")
                        .map((h) => h.trim())
                        .filter(Boolean)
                    : undefined,
                });
              }}
            >
              {publishMutation.isPending ? "Publishing..." : "Publish Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog
        open={!!scheduleDialogVideoId}
        onOpenChange={(open) => {
          if (!open) {
            setScheduleDialogVideoId(null);
            resetScheduleForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule for Later</DialogTitle>
            <DialogDescription>
              Choose when to publish this video to TikTok.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>TikTok Account</Label>
              {activeAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No TikTok accounts connected.{" "}
                  <a
                    href="/accounts"
                    className="text-[#7C3AED] hover:underline"
                  >
                    Connect one
                  </a>
                </p>
              ) : (
                <Select
                  value={scheduleAccountId}
                  onValueChange={(v) => setScheduleAccountId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        @{account.handle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Caption</Label>
              <Input
                placeholder="Write a caption..."
                value={scheduleCaption}
                onChange={(e) => setScheduleCaption(e.target.value)}
                maxLength={150}
              />
            </div>

            <div className="space-y-2">
              <Label>Hashtags</Label>
              <Input
                placeholder="#viral #fyp (comma separated)"
                value={scheduleHashtags}
                onChange={(e) => setScheduleHashtags(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
              disabled={
                !scheduleAccountId ||
                !scheduleDate ||
                !scheduleTime ||
                scheduleMutation.isPending ||
                !scheduleDialogVideoId
              }
              onClick={() => {
                if (
                  !scheduleDialogVideoId ||
                  !scheduleAccountId ||
                  !scheduleDate ||
                  !scheduleTime
                )
                  return;
                const scheduledAt = new Date(
                  `${scheduleDate}T${scheduleTime}:00`
                );
                scheduleMutation.mutate({
                  videoId: scheduleDialogVideoId,
                  tiktokAccountId: scheduleAccountId,
                  scheduledPublishAt: scheduledAt.toISOString(),
                  caption: scheduleCaption || undefined,
                  hashtags: scheduleHashtags
                    ? scheduleHashtags
                        .split(",")
                        .map((h) => h.trim())
                        .filter(Boolean)
                    : undefined,
                });
              }}
            >
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish error */}
      {publishMutation.error && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-red-200 bg-red-50 p-4 shadow-lg">
          <p className="text-sm text-red-700">
            Publish failed: {publishMutation.error.message}
          </p>
        </div>
      )}

      {/* Schedule error */}
      {scheduleMutation.error && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-red-200 bg-red-50 p-4 shadow-lg">
          <p className="text-sm text-red-700">
            Schedule failed: {scheduleMutation.error.message}
          </p>
        </div>
      )}
    </div>
  );
}
