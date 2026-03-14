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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

type ToneOfVoice = "CASUAL" | "PROFESSIONAL" | "HYPE" | "EDUCATIONAL" | "TESTIMONIAL";

const TONE_LABELS: Record<ToneOfVoice, string> = {
  CASUAL: "Casual",
  PROFESSIONAL: "Professional",
  HYPE: "Hype",
  EDUCATIONAL: "Educational",
  TESTIMONIAL: "Testimonial",
};

const TONE_COLORS: Record<ToneOfVoice, string> = {
  CASUAL: "bg-blue-100 text-blue-700",
  PROFESSIONAL: "bg-gray-100 text-gray-700",
  HYPE: "bg-orange-100 text-orange-700",
  EDUCATIONAL: "bg-green-100 text-green-700",
  TESTIMONIAL: "bg-purple-100 text-purple-700",
};

interface BrandKitFormData {
  name: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  toneOfVoice: ToneOfVoice;
  targetAudience: string;
}

const emptyForm: BrandKitFormData = {
  name: "",
  logoUrl: "",
  primaryColor: "#7C3AED",
  secondaryColor: "#1E1B4B",
  accentColor: "#A3E635",
  backgroundColor: "#FFFFFF",
  toneOfVoice: "CASUAL",
  targetAudience: "",
};

export default function BrandKitsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BrandKitFormData>({ ...emptyForm });

  const brandKitsQuery = trpc.brandKit.list.useQuery();

  const createMutation = trpc.brandKit.create.useMutation({
    onSuccess: () => {
      setShowCreateDialog(false);
      setForm({ ...emptyForm });
      brandKitsQuery.refetch();
    },
  });

  const updateMutation = trpc.brandKit.update.useMutation({
    onSuccess: () => {
      brandKitsQuery.refetch();
    },
  });

  const deleteMutation = trpc.brandKit.delete.useMutation({
    onSuccess: () => {
      setEditingId(null);
      brandKitsQuery.refetch();
    },
  });

  function openEdit(kitId: string) {
    const kit = brandKitsQuery.data?.find((k) => k.id === kitId);
    if (!kit) return;
    const colors = (kit.colors ?? {}) as Record<string, string>;
    setForm({
      name: kit.name,
      logoUrl: kit.logoUrl ?? "",
      primaryColor: colors.primary ?? "#7C3AED",
      secondaryColor: colors.secondary ?? "#1E1B4B",
      accentColor: colors.accent ?? "#A3E635",
      backgroundColor: colors.background ?? "#FFFFFF",
      toneOfVoice: kit.toneOfVoice as ToneOfVoice,
      targetAudience: kit.targetAudience ?? "",
    });
    setEditingId(kitId);
  }

  function handleCreate() {
    createMutation.mutate({
      name: form.name,
      logoUrl: form.logoUrl || undefined,
      colors: {
        primary: form.primaryColor,
        secondary: form.secondaryColor,
        accent: form.accentColor,
        background: form.backgroundColor,
      },
      toneOfVoice: form.toneOfVoice,
      targetAudience: form.targetAudience || undefined,
    });
  }

  function handleUpdate() {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      name: form.name,
      logoUrl: form.logoUrl || undefined,
      colors: {
        primary: form.primaryColor,
        secondary: form.secondaryColor,
        accent: form.accentColor,
        background: form.backgroundColor,
      },
      toneOfVoice: form.toneOfVoice,
      targetAudience: form.targetAudience || undefined,
    });
  }

  function renderForm(mode: "create" | "edit") {
    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="kit-name">Brand Kit Name</Label>
          <Input
            id="kit-name"
            placeholder="e.g., My Brand"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="kit-logo">Logo URL</Label>
          <Input
            id="kit-logo"
            placeholder="https://example.com/logo.png"
            value={form.logoUrl}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
          />
          {form.logoUrl && (
            <div className="mt-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.logoUrl}
                alt="Logo preview"
                className="h-full w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </div>

        <div>
          <Label>Colors</Label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(
              [
                ["primaryColor", "Primary"],
                ["secondaryColor", "Secondary"],
                ["accentColor", "Accent"],
                ["backgroundColor", "Background"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded border"
                  style={{ backgroundColor: form[key] }}
                />
                <Input
                  placeholder={label}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="text-xs"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label>Tone of Voice</Label>
          <Select
            value={form.toneOfVoice}
            onValueChange={(v) =>
              setForm({ ...form, toneOfVoice: v as ToneOfVoice })
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TONE_LABELS) as ToneOfVoice[]).map((tone) => (
                <SelectItem key={tone} value={tone}>
                  {TONE_LABELS[tone]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="kit-audience">Target Audience</Label>
          <Textarea
            id="kit-audience"
            placeholder="e.g., Women aged 25-34 interested in skincare and beauty..."
            value={form.targetAudience}
            onChange={(e) =>
              setForm({ ...form, targetAudience: e.target.value })
            }
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          {mode === "create" ? (
            <Button
              className="flex-1 bg-[#7C3AED] hover:bg-[#7C3AED]/90"
              disabled={!form.name || createMutation.isPending}
              onClick={handleCreate}
            >
              {createMutation.isPending ? "Creating..." : "Create Brand Kit"}
            </Button>
          ) : (
            <>
              <Button
                className="flex-1 bg-[#7C3AED] hover:bg-[#7C3AED]/90"
                disabled={!form.name || updateMutation.isPending}
                onClick={handleUpdate}
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (editingId) deleteMutation.mutate({ id: editingId });
                }}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            </>
          )}
        </div>

        {createMutation.error && (
          <p className="text-sm text-red-600">{createMutation.error.message}</p>
        )}
        {updateMutation.error && (
          <p className="text-sm text-red-600">{updateMutation.error.message}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Brand Kits</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define your brand identity: logo, colors, tone, and audience.
          </p>
        </div>
        <Button
          className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
          onClick={() => {
            setForm({ ...emptyForm });
            setShowCreateDialog(true);
          }}
        >
          + Create Brand Kit
        </Button>
      </div>

      {brandKitsQuery.isLoading ? (
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
      ) : (brandKitsQuery.data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <div className="mb-4 text-5xl">🎨</div>
            <h3 className="text-lg font-medium">No brand kits yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a brand kit to maintain consistent styling across your
              videos.
            </p>
            <Button
              className="mt-4 bg-[#7C3AED] hover:bg-[#7C3AED]/90"
              onClick={() => {
                setForm({ ...emptyForm });
                setShowCreateDialog(true);
              }}
            >
              Create Brand Kit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brandKitsQuery.data?.map((kit) => {
            const colors = (kit.colors ?? {}) as Record<string, string>;
            return (
              <Card
                key={kit.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => openEdit(kit.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {kit.logoUrl ? (
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={kit.logoUrl}
                            alt={kit.name}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#7C3AED]/10 text-lg">
                          🎨
                        </div>
                      )}
                      <CardTitle className="text-base">{kit.name}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Color swatches */}
                  <div className="mb-3 flex gap-1">
                    {Object.entries(colors).map(([key, value]) =>
                      value ? (
                        <div
                          key={key}
                          className="h-6 w-6 rounded-full border"
                          style={{ backgroundColor: value }}
                          title={`${key}: ${value}`}
                        />
                      ) : null
                    )}
                  </div>

                  <Badge
                    variant="outline"
                    className={TONE_COLORS[kit.toneOfVoice as ToneOfVoice]}
                  >
                    {TONE_LABELS[kit.toneOfVoice as ToneOfVoice]}
                  </Badge>

                  {kit.targetAudience && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {kit.targetAudience}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Brand Kit</DialogTitle>
            <DialogDescription>
              Define your brand identity for consistent video styling.
            </DialogDescription>
          </DialogHeader>
          {renderForm("create")}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingId}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Brand Kit</DialogTitle>
            <DialogDescription>
              Update your brand identity settings.
            </DialogDescription>
          </DialogHeader>
          {renderForm("edit")}
        </DialogContent>
      </Dialog>
    </div>
  );
}
