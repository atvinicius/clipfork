"use client";

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
import { Progress } from "@/components/ui/progress";

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

export default function DashboardPage() {
  const creditsQuery = trpc.credits.getBalance.useQuery();
  const recentVideosQuery = trpc.video.list.useQuery({ limit: 5 });
  const allVideosQuery = trpc.video.list.useQuery({ limit: 50 });

  const balance = creditsQuery.data?.balance ?? 0;
  const monthly = creditsQuery.data?.monthly ?? 0;
  const plan = creditsQuery.data?.plan ?? "FREE";
  const usagePercent = monthly > 0 ? Math.round((balance / monthly) * 100) : 0;

  const allVideos = allVideosQuery.data?.videos ?? [];
  const totalVideos = allVideos.length;
  const completedThisMonth = allVideos.filter((v) => {
    const now = new Date();
    const created = new Date(v.createdAt);
    return (
      v.status === "COMPLETED" &&
      created.getMonth() === now.getMonth() &&
      created.getFullYear() === now.getFullYear()
    );
  }).length;
  const activeJobs = allVideos.filter((v) =>
    ["QUEUED", "SCRAPING", "SCRIPTING", "GENERATING_AUDIO", "GENERATING_AVATAR", "COMPOSING"].includes(v.status)
  ).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your account, credits, and recent activity.
        </p>
      </div>

      {/* Quick actions */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card
          className="cursor-pointer border-[#7C3AED]/30 bg-gradient-to-br from-[#7C3AED]/5 to-[#7C3AED]/10 transition-shadow hover:shadow-md"
          onClick={() => (window.location.href = "/create")}
        >
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#7C3AED] text-2xl text-white">
              +
            </div>
            <div>
              <h3 className="font-semibold">Create Video</h3>
              <p className="text-sm text-muted-foreground">
                Generate a new UGC video from a product
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer border-[#A3E635]/30 bg-gradient-to-br from-[#A3E635]/5 to-[#A3E635]/10 transition-shadow hover:shadow-md"
          onClick={() => (window.location.href = "/clone")}
        >
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#A3E635] text-2xl text-[#1E1B4B]">
              ⚡
            </div>
            <div>
              <h3 className="font-semibold">Clone Viral</h3>
              <p className="text-sm text-muted-foreground">
                Remix a trending video with your product
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats grid */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Credits card */}
        <Card className="sm:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Credits</CardTitle>
              <Badge
                variant="outline"
                className="bg-[#7C3AED]/10 text-[#7C3AED]"
              >
                {plan}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {creditsQuery.isLoading ? (
              <div className="h-16 animate-pulse rounded bg-muted" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#7C3AED]">
                    {balance}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {monthly} monthly
                  </span>
                </div>
                <Progress value={usagePercent} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {usagePercent}% remaining this billing cycle
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total videos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Total Videos</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{totalVideos}</span>
          </CardContent>
        </Card>

        {/* Completed this month */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Completed</CardTitle>
            <CardDescription>This month</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-green-600">
              {completedThisMonth}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Active jobs banner */}
      {activeJobs > 0 && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-200 text-lg dark:bg-yellow-800">
                ⏳
              </div>
              <div>
                <p className="text-sm font-medium">
                  {activeJobs} active job{activeJobs > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Videos are currently being generated
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (window.location.href = "/videos")}
            >
              View All
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent videos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Videos</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-[#7C3AED] hover:text-[#7C3AED]"
              onClick={() => (window.location.href = "/videos")}
            >
              View all
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentVideosQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (recentVideosQuery.data?.videos.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center py-8">
              <p className="text-sm text-muted-foreground">
                No videos created yet. Start by creating your first video!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentVideosQuery.data?.videos.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#1E1B4B] to-[#7C3AED]/60 text-white">
                    {video.status === "COMPLETED" ? "▶" : "⏳"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">
                      {video.product?.name || "Untitled Video"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {video.type === "TALKING_HEAD"
                        ? "Talking Head"
                        : "Faceless"}{" "}
                      &middot;{" "}
                      {new Date(video.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={STATUS_COLORS[video.status]}
                  >
                    {STATUS_LABELS[video.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
