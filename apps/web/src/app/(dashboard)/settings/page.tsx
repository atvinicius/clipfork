"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Settings, Users, Key, AlertTriangle } from "lucide-react";

const ROLE_STYLES: Record<string, string> = {
  OWNER: "bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/30",
  ADMIN: "bg-blue-100 text-blue-700 border-blue-200",
  MEMBER: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function SettingsPage() {
  const orgQuery = trpc.org.getCurrent.useQuery();
  const membersQuery = trpc.org.getMembers.useQuery();
  const brandKitsQuery = trpc.brandKit.list.useQuery();
  const tiktokAccountsQuery = trpc.tiktok.list.useQuery();

  const [orgName, setOrgName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [defaultBrandKitId, setDefaultBrandKitId] = useState("none");
  const [defaultTiktokAccountId, setDefaultTiktokAccountId] = useState("none");

  // Notification preferences (client-side state)
  const [notifyOutlier, setNotifyOutlier] = useState(true);
  const [notifyVideoCompleted, setNotifyVideoCompleted] = useState(true);
  const [notifyVideoFailed, setNotifyVideoFailed] = useState(true);

  const org = orgQuery.data;
  const members = membersQuery.data ?? [];
  const brandKits = brandKitsQuery.data ?? [];
  const tiktokAccounts = tiktokAccountsQuery.data ?? [];

  // Set initial org name
  if (org && !nameEdited && !orgName) {
    setOrgName(org.name);
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#7C3AED] text-white">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Organization settings and team management.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Organization Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization</CardTitle>
            <CardDescription>
              Your current organization details and plan information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <div className="flex gap-3">
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => {
                      setOrgName(e.target.value);
                      setNameEdited(true);
                    }}
                    placeholder="Your organization name"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    disabled={!nameEdited || !orgName.trim()}
                    onClick={() => setNameEdited(false)}
                  >
                    Save
                  </Button>
                </div>
              </div>

              {org && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Current Plan
                    </p>
                    <Badge
                      variant="outline"
                      className="bg-[#7C3AED]/10 text-[#7C3AED]"
                    >
                      {org.plan}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Credits Balance
                    </p>
                    <p className="text-sm font-semibold text-[#1E1B4B]">
                      {org.creditsBalance}{" "}
                      <span className="font-normal text-muted-foreground">
                        / {org.creditsMonthly} monthly
                      </span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Member Since
                    </p>
                    <p className="text-sm font-semibold text-[#1E1B4B]">
                      {new Date(org.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#7C3AED]" />
              <CardTitle className="text-base">Team Members</CardTitle>
            </div>
            <CardDescription>
              People who have access to this organization. Managed via Clerk.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {membersQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded bg-muted"
                  />
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No team members found.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={ROLE_STYLES[member.role] ?? ""}
                        >
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(member.createdAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Default Selections */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Defaults</CardTitle>
            <CardDescription>
              Set default selections for new videos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Default Brand Kit</Label>
                <Select
                  value={defaultBrandKitId}
                  onValueChange={(v) => setDefaultBrandKitId(v ?? "none")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No default brand kit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No default</SelectItem>
                    {brandKits.map((kit) => (
                      <SelectItem key={kit.id} value={kit.id}>
                        {kit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default TikTok Account</Label>
                <Select
                  value={defaultTiktokAccountId}
                  onValueChange={(v) => setDefaultTiktokAccountId(v ?? "none")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No default account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No default</SelectItem>
                    {tiktokAccounts
                      .filter((a) => a.isActive)
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          @{account.handle}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {tiktokAccounts.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No TikTok accounts connected.{" "}
                    <a
                      href="/accounts"
                      className="text-[#7C3AED] hover:underline"
                    >
                      Connect one
                    </a>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>
              Choose which email notifications you receive.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Outlier Found</p>
                  <p className="text-xs text-muted-foreground">
                    Get notified when a viral outlier is detected
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifyOutlier(!notifyOutlier)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    notifyOutlier ? "bg-[#7C3AED]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifyOutlier ? "translate-x-[18px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Video Completed</p>
                  <p className="text-xs text-muted-foreground">
                    Get notified when a video finishes generating
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNotifyVideoCompleted(!notifyVideoCompleted)
                  }
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    notifyVideoCompleted ? "bg-[#7C3AED]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifyVideoCompleted
                        ? "translate-x-[18px]"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Video Failed</p>
                  <p className="text-xs text-muted-foreground">
                    Get notified when a video generation fails
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifyVideoFailed(!notifyVideoFailed)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    notifyVideoFailed ? "bg-[#7C3AED]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifyVideoFailed
                        ? "translate-x-[18px]"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-[#7C3AED]" />
              <CardTitle className="text-base">API Keys</CardTitle>
            </div>
            <CardDescription>
              Manage API keys for integrating ClipFork with your applications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center rounded-lg border border-dashed border-[#7C3AED]/30 bg-[#7C3AED]/5 py-8">
              <Key className="mb-3 h-8 w-8 text-[#7C3AED]/40" />
              <p className="text-sm font-medium text-[#1E1B4B]">
                API Integration Coming Soon
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Programmatic access to ClipFork video generation is on our
                roadmap.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <CardTitle className="text-base text-red-600">
                Danger Zone
              </CardTitle>
            </div>
            <CardDescription>
              Irreversible and destructive actions for this organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:bg-red-950/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    Delete Organization
                  </p>
                  <p className="mt-1 text-xs text-red-600/80 dark:text-red-400/70">
                    Permanently delete this organization and all of its data
                    including videos, products, brand kits, and team members.
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
