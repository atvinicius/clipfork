"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PlusCircle,
  Copy,
  LayoutTemplate,
  Eye,
  Video,
  Package,
  Palette,
  ImageIcon,
  Settings,
  CreditCard,
  MonitorPlay,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Create Video", icon: PlusCircle },
  { href: "/clone", label: "Clone Viral", icon: Copy },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/competitors", label: "Competitor Intel", icon: Eye },
  { href: "/videos", label: "My Videos", icon: Video },
  { href: "/products", label: "Products", icon: Package },
  { href: "/brand-kits", label: "Brand Kits", icon: Palette },
  { href: "/assets", label: "Asset Library", icon: ImageIcon },
];

const bottomNav = [
  { href: "/accounts", label: "TikTok Accounts", icon: MonitorPlay },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="flex h-screen w-64 flex-col border-r bg-white">
        <div className="flex h-14 items-center px-4 font-semibold text-lg">
          UGC Platform
        </div>
        <Separator />
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        pathname === item.href
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="lg:hidden">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        </nav>
        <Separator />
        <nav className="px-2 py-4">
          <ul className="space-y-1">
            {bottomNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </TooltipProvider>
  );
}
