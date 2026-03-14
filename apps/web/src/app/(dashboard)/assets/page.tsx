"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AssetType = "IMAGE" | "VIDEO" | "AUDIO" | "MUSIC";
type AssetFilter = "ALL" | AssetType;

const TYPE_LABELS: Record<AssetType, string> = {
  IMAGE: "Image",
  VIDEO: "Video",
  AUDIO: "Audio",
  MUSIC: "Music",
};

const TYPE_COLORS: Record<AssetType, string> = {
  IMAGE: "bg-blue-100 text-blue-700",
  VIDEO: "bg-purple-100 text-purple-700",
  AUDIO: "bg-green-100 text-green-700",
  MUSIC: "bg-orange-100 text-orange-700",
};

const TYPE_ICONS: Record<AssetType, string> = {
  IMAGE: "🖼",
  VIDEO: "🎬",
  AUDIO: "🎙",
  MUSIC: "🎵",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeAssetType(mimeType: string): AssetType {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) {
    if (mimeType.includes("music") || mimeType.includes("mp3") || mimeType.includes("wav")) {
      return "MUSIC";
    }
    return "AUDIO";
  }
  return "IMAGE";
}

export default function AssetsPage() {
  const [filter, setFilter] = useState<AssetFilter>("ALL");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);

  const assetsQuery = trpc.asset.list.useQuery({
    limit: 50,
    type: filter === "ALL" ? undefined : filter,
  });

  const getUploadUrlMutation = trpc.asset.getUploadUrl.useMutation();
  const createAssetMutation = trpc.asset.create.useMutation({
    onSuccess: () => {
      assetsQuery.refetch();
    },
  });

  const deleteAssetMutation = trpc.asset.delete.useMutation({
    onSuccess: () => {
      assetsQuery.refetch();
    },
  });

  const handleUpload = useCallback(
    async (files: FileList) => {
      const fileArray = Array.from(files);
      const fileNames = fileArray.map((f) => f.name);
      setUploadingFiles((prev) => [...prev, ...fileNames]);

      for (const file of fileArray) {
        try {
          // Get presigned upload URL
          const { uploadUrl, publicUrl } =
            await getUploadUrlMutation.mutateAsync({
              filename: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
            });

          // Upload to R2
          await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });

          // Register asset in DB
          await createAssetMutation.mutateAsync({
            type: getMimeAssetType(file.type),
            url: publicUrl,
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          });
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
        }
      }

      setUploadingFiles((prev) =>
        prev.filter((name) => !fileNames.includes(name))
      );
    },
    [getUploadUrlMutation, createAssetMutation]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
      }
    },
    [handleUpload]
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Asset Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload and manage images, videos, audio, and music.
        </p>
      </div>

      {/* Upload area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`mb-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-[#7C3AED] bg-[#7C3AED]/5"
            : "border-muted-foreground/25 hover:border-[#7C3AED]/50"
        }`}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.multiple = true;
          input.accept = "image/*,video/*,audio/*";
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) handleUpload(files);
          };
          input.click();
        }}
      >
        <div className="mb-3 text-4xl">
          {isDragging ? "📂" : "☁"}
        </div>
        <p className="text-sm font-medium">
          {isDragging ? "Drop files here" : "Drag and drop files here"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          or click to browse. Supports images, videos, and audio files.
        </p>
        {uploadingFiles.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">
              Uploading {uploadingFiles.length} file(s)...
            </p>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as AssetFilter)}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="ALL">All</TabsTrigger>
          <TabsTrigger value="IMAGE">Images</TabsTrigger>
          <TabsTrigger value="VIDEO">Videos</TabsTrigger>
          <TabsTrigger value="AUDIO">Audio</TabsTrigger>
          <TabsTrigger value="MUSIC">Music</TabsTrigger>
        </TabsList>
      </Tabs>

      {assetsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-0">
                <div className="h-32 bg-muted" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (assetsQuery.data?.assets.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <div className="mb-4 text-5xl">📁</div>
            <h3 className="text-lg font-medium">No assets yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload your first asset using the drag and drop area above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {assetsQuery.data?.assets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Thumbnail */}
                <div className="flex h-32 items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                  {asset.type === "IMAGE" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.url}
                      alt={asset.filename}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).parentElement!.innerHTML =
                          '<span class="text-3xl">🖼</span>';
                      }}
                    />
                  ) : (
                    <span className="text-3xl">
                      {TYPE_ICONS[asset.type as AssetType]}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">
                    {asset.filename}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`text-xs ${TYPE_COLORS[asset.type as AssetType]}`}
                    >
                      {TYPE_LABELS[asset.type as AssetType]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(asset.sizeBytes)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => deleteAssetMutation.mutate({ id: asset.id })}
                      disabled={deleteAssetMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
