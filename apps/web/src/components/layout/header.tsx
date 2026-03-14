"use client";

import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";

const UserButton = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.UserButton),
  { ssr: false }
);

export function Header({ creditsBalance }: { creditsBalance?: number }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        {creditsBalance !== undefined && (
          <Badge variant="secondary" className="text-sm">
            {creditsBalance} credits
          </Badge>
        )}
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
