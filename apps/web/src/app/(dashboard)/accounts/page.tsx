"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import { MonitorPlay, Shield, ExternalLink } from "lucide-react";

function getConnectionStatus(
  isActive: boolean,
  tokenExpiresAt: string | Date | null
) {
  if (!isActive) {
    return {
      label: "Inactive",
      className: "bg-gray-100 text-gray-700 border-gray-200",
    };
  }
  if (tokenExpiresAt && new Date(tokenExpiresAt) < new Date()) {
    return {
      label: "Token Expired",
      className: "bg-red-100 text-red-700 border-red-200",
    };
  }
  return {
    label: "Active",
    className: "bg-green-100 text-green-700 border-green-200",
  };
}

export default function AccountsPage() {
  const searchParams = useSearchParams();
  const callbackCode = searchParams.get("code");

  const accountsQuery = trpc.tiktok.list.useQuery();

  const authUrlQuery = trpc.tiktok.getAuthUrl.useQuery(undefined, {
    enabled: false,
  });

  const handleCallbackMutation = trpc.tiktok.handleCallback.useMutation({
    onSuccess: () => {
      accountsQuery.refetch();
      window.history.replaceState({}, "", "/accounts");
    },
  });

  const disconnectMutation = trpc.tiktok.disconnect.useMutation({
    onSuccess: () => {
      accountsQuery.refetch();
    },
  });

  // Handle OAuth callback
  useEffect(() => {
    if (
      callbackCode &&
      !handleCallbackMutation.isPending &&
      !handleCallbackMutation.isSuccess &&
      !handleCallbackMutation.isError
    ) {
      handleCallbackMutation.mutate({ code: callbackCode });
    }
  }, [callbackCode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConnect() {
    const result = await authUrlQuery.refetch();
    if (result.data?.url) {
      window.location.href = result.data.url;
    }
  }

  const accounts = accountsQuery.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">TikTok Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect and manage your TikTok accounts for auto-publishing.
          </p>
        </div>
        <Button
          className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
          onClick={handleConnect}
          disabled={authUrlQuery.isFetching}
        >
          <ExternalLink className="mr-1.5 size-4" />
          {authUrlQuery.isFetching
            ? "Connecting..."
            : "Connect TikTok Account"}
        </Button>
      </div>

      {/* Callback status messages */}
      {handleCallbackMutation.isPending && (
        <Card className="mb-6 border-[#7C3AED]/30 bg-[#7C3AED]/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-[#7C3AED]">
              Connecting your TikTok account...
            </p>
          </CardContent>
        </Card>
      )}

      {handleCallbackMutation.isSuccess && (
        <Card className="mb-6 border-green-300 bg-green-50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-green-700">
              TikTok account connected successfully!
            </p>
          </CardContent>
        </Card>
      )}

      {handleCallbackMutation.isError && (
        <Card className="mb-6 border-red-300 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-red-700">
              Failed to connect: {handleCallbackMutation.error.message}
            </p>
          </CardContent>
        </Card>
      )}

      {accountsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="mt-3 h-3 w-1/2 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <div className="mb-4">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted-foreground"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <h3 className="text-lg font-medium">No accounts connected</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Connect your TikTok account to start auto-publishing videos
              directly from ClipFork.
            </p>
            <Button
              className="mt-4 bg-[#7C3AED] hover:bg-[#7C3AED]/90"
              onClick={handleConnect}
              disabled={authUrlQuery.isFetching}
            >
              {authUrlQuery.isFetching
                ? "Connecting..."
                : "Connect TikTok Account"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const status = getConnectionStatus(
              account.isActive,
              account.tokenExpiresAt
            );
            return (
              <Card key={account.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E1B4B] text-white">
                        <MonitorPlay className="size-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          @{account.handle}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Connected{" "}
                          {new Date(account.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={status.className}>
                      {status.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      disconnectMutation.mutate({ id: account.id })
                    }
                    disabled={
                      disconnectMutation.isPending || !account.isActive
                    }
                  >
                    {!account.isActive
                      ? "Disconnected"
                      : disconnectMutation.isPending
                        ? "Disconnecting..."
                        : "Disconnect"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Informational card */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#7C3AED]/10">
              <Shield className="size-5 text-[#7C3AED]" />
            </div>
            <div>
              <CardTitle>How TikTok publishing works</CardTitle>
              <CardDescription>
                Secure OAuth connection to your TikTok account
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
              ClipFork connects to TikTok via OAuth so your password is never
              shared or stored.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
              Once connected, videos you create can be published directly to
              your TikTok account or scheduled for later.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
              Videos are posted as &quot;Self Only&quot; by default for your
              review before going public.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
              You can disconnect your account at any time. This revokes
              ClipFork&apos;s access immediately.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
