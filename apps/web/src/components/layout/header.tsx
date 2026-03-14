import { UserButton } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";

export function Header({ creditsBalance }: { creditsBalance?: number }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        {creditsBalance !== undefined && (
          <Badge className="bg-[#7C3AED] text-white hover:bg-[#7C3AED]/90 text-sm">
            {creditsBalance} credits
          </Badge>
        )}
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
