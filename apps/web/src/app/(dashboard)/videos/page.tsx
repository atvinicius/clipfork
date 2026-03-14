"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StatusFilter = "ALL" | "COMPLETED" | "PROCESSING" | "FAILED";

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "bg-gray-100 text-gray-700 border-gray-200",
  SCRAPING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  SCRIPTING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  GENERATING_AUDIO: "bg-yellow-100 text-yellow-700 border-yellow-200",
  GENERATING_AVATAR: "bg-yellow-100 text-yellow-700 border-yellow-200",
  COMPOSING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  COMPLETED: "bg-green-100 text-green-700 border-green-200",
  FAILED: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  SCRAPING: "Scraping",
  SCRIPTING: "Scripting",
  GENERATING_AUDIO: "Audio",
  GENERATING_AVATAR: "Avatar",
  COMPOSING: "Composing",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

function isProcessingStatus(status: string) {
  return ["SCRAPING", "SCRIPTING", "GENERATING_AUDIO", "GENERATING_AVATAR", "COMPOSING"].includes(status);
}

export default function VideosPage() {
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

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

  const deleteVideoMutation = trpc.video.delete.useMutation({
    onSuccess: () => {
      setSelectedVideoId(null);
      videosQuery.refetch();
    },
  });

  const filteredVideos = (() => {
    const videos = videosQuery.data?.videos ?? [];
    if (filter === "PROCESSING") {
      return videos.filter((v) => isProcessingStatus(v.status) || v.status === "QUEUED");
    }
    return videos;
  })();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Videos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View, download, and manage your generated videos.
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
            <div className="mb-4 text-5xl">🎬</div>
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
                {/* Thumbnail placeholder */}
                <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-[#1E1B4B] to-[#7C3AED]/60">
                  <span className="text-4xl">
                    {video.status === "COMPLETED" ? "▶" : "⏳"}
                  </span>
                  {video.duration && (
                    <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                      {Math.round(video.duration)}s
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="truncate text-sm font-medium">
                    {video.product?.name || "Untitled Video"}
                  </h3>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[video.status]}
                    >
                      {STATUS_LABELS[video.status]}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {video.type === "TALKING_HEAD"
                        ? "Talking Head"
                        : "Faceless"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{video.creditsUsed} credits</span>
                    <span>
                      {new Date(video.createdAt).toLocaleDateString()}
                    </span>
                  </div>
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
              {/* Video player placeholder */}
              <div className="flex h-64 items-center justify-center rounded-lg bg-gradient-to-br from-[#1E1B4B] to-[#7C3AED]/60">
                {selectedVideoQuery.data.finalVideoUrl ? (
                  <video
                    src={selectedVideoQuery.data.finalVideoUrl}
                    controls
                    className="h-full w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="text-center">
                    <span className="text-4xl">🎬</span>
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

              {selectedVideoQuery.data.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-medium text-red-700">Error</p>
                  <p className="mt-1 text-sm text-red-600">
                    {selectedVideoQuery.data.error}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                {selectedVideoQuery.data.finalVideoUrl && (
                  <Button
                    className="flex-1 bg-[#7C3AED] hover:bg-[#7C3AED]/90"
                    asChild
                  >
                    <a
                      href={selectedVideoQuery.data.finalVideoUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download
                    </a>
                  </Button>
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
    </div>
  );
}
