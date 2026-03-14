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
    <aside className="flex h-screen w-64 flex-col" style={{ backgroundColor: "#1E1B4B" }}>
      <div className="flex h-14 items-center px-4 text-lg tracking-tight">
        <span className="font-normal text-white">Clip</span>
        <span className="font-bold text-white">Fork</span>
      </div>
      <div className="mx-4 h-px bg-white/10" />
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="space-y-1">
          {mainNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
                style={pathname === item.href ? { backgroundColor: "#7C3AED" } : undefined}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mx-4 h-px bg-white/10" />
      <nav className="px-2 py-4">
        <ul className="space-y-1">
          {bottomNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
                style={pathname === item.href ? { backgroundColor: "#7C3AED" } : undefined}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
