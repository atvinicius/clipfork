"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCard, Zap, Check, ExternalLink } from "lucide-react";

const PLANS = [
  {
    id: "FREE",
    name: "Free",
    price: 0,
    credits: 3,
    features: ["3 videos/month", "Basic templates", "720p export"],
  },
  {
    id: "STARTER",
    name: "Starter",
    price: 29,
    credits: 30,
    priceId: "price_starter",
    features: [
      "30 videos/month",
      "All templates",
      "1080p export",
      "Brand kits",
    ],
  },
  {
    id: "GROWTH",
    name: "Growth",
    price: 79,
    credits: 100,
    priceId: "price_growth",
    features: [
      "100 videos/month",
      "Clone viral videos",
      "Priority processing",
      "Competitor intel",
    ],
  },
  {
    id: "SCALE",
    name: "Scale",
    price: 199,
    credits: 300,
    priceId: "price_scale",
    features: [
      "300 videos/month",
      "API access",
      "White-label export",
      "Dedicated support",
    ],
  },
];

const PLAN_ORDER = ["FREE", "STARTER", "GROWTH", "SCALE"];

export default function BillingPage() {
  const planQuery = trpc.billing.getPlan.useQuery();
  const transactionsQuery = trpc.credits.getTransactions.useQuery({ limit: 10 });

  const createPortalSession = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const createCheckoutSession = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const currentPlan = planQuery.data?.plan ?? "FREE";
  const creditsBalance = planQuery.data?.creditsBalance ?? 0;
  const creditsMonthly = planQuery.data?.creditsMonthly ?? 0;
  const usagePercent =
    creditsMonthly > 0
      ? Math.round((creditsBalance / creditsMonthly) * 100)
      : 0;

  const currentPlanIndex = PLAN_ORDER.indexOf(currentPlan);
  const currentPlanConfig = PLANS.find((p) => p.id === currentPlan);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your subscription, view usage, and update payment methods.
        </p>
      </div>

      {/* Current Plan & Usage Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {/* Current Plan Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-[#7C3AED]" />
                <CardTitle className="text-base">Current Plan</CardTitle>
              </div>
              <Badge
                variant="outline"
                className="bg-[#7C3AED]/10 text-[#7C3AED]"
              >
                {currentPlanConfig?.name ?? currentPlan}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {planQuery.isLoading ? (
              <div className="h-20 animate-pulse rounded bg-muted" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#7C3AED]">
                    {creditsBalance}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {creditsMonthly} credits this month
                  </span>
                </div>
                {currentPlanConfig && (
                  <p className="text-sm text-muted-foreground">
                    {currentPlanConfig.price === 0
                      ? "Free forever"
                      : `$${currentPlanConfig.price}/month`}
                  </p>
                )}
              </div>
            )}
          </CardContent>
          {currentPlan !== "FREE" && (
            <CardFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => createPortalSession.mutate()}
                disabled={createPortalSession.isPending}
              >
                <ExternalLink className="size-3.5" />
                {createPortalSession.isPending
                  ? "Loading..."
                  : "Manage Subscription"}
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Usage Summary Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-[#7C3AED]" />
              <CardTitle className="text-base">Usage Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {planQuery.isLoading ? (
              <div className="h-20 animate-pulse rounded bg-muted" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Credits used</span>
                  <span className="font-medium">
                    {creditsMonthly - creditsBalance} / {creditsMonthly}
                  </span>
                </div>
                <Progress value={100 - usagePercent} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{usagePercent}% remaining</span>
                  <span>{creditsBalance} credits left</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pricing Plans */}
      <div className="mb-6">
        <h2 className="mb-4 text-lg font-semibold">Plans</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const planIndex = PLAN_ORDER.indexOf(plan.id);
            const isCurrent = plan.id === currentPlan;
            const isUpgrade = planIndex > currentPlanIndex;
            const isDowngrade = planIndex < currentPlanIndex;

            return (
              <Card
                key={plan.id}
                className={
                  isCurrent
                    ? "ring-2 ring-[#7C3AED]"
                    : ""
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    {isCurrent && (
                      <Badge className="bg-[#7C3AED] text-white">
                        Current Plan
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    <span className="text-2xl font-bold text-foreground">
                      ${plan.price}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm font-medium text-[#7C3AED]">
                    {plan.credits} credits/month
                  </p>
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="size-3.5 shrink-0 text-[#7C3AED]" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {isCurrent ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled
                    >
                      Current Plan
                    </Button>
                  ) : isUpgrade ? (
                    <Button
                      size="sm"
                      className="w-full bg-[#7C3AED] hover:bg-[#7C3AED]/90"
                      onClick={() =>
                        createCheckoutSession.mutate({
                          priceId: plan.priceId!,
                        })
                      }
                      disabled={createCheckoutSession.isPending}
                    >
                      {createCheckoutSession.isPending
                        ? "Loading..."
                        : "Upgrade"}
                    </Button>
                  ) : isDowngrade ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => createPortalSession.mutate()}
                      disabled={createPortalSession.isPending}
                    >
                      {createPortalSession.isPending
                        ? "Loading..."
                        : "Downgrade"}
                    </Button>
                  ) : null}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Credit Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-[#7C3AED]" />
            <CardTitle className="text-base">Recent Transactions</CardTitle>
          </div>
          <CardDescription>
            Your latest credit activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : !transactionsQuery.data?.transactions?.length ? (
            <div className="flex flex-col items-center py-8">
              <p className="text-sm text-muted-foreground">
                No transactions yet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionsQuery.data.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Badge
                        variant={tx.amount > 0 ? "default" : "secondary"}
                        className={
                          tx.amount > 0
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "bg-gray-100 text-gray-700 border-gray-200"
                        }
                      >
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tx.referenceId ? tx.referenceId.substring(0, 8) + "..." : "--"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        tx.amount > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
