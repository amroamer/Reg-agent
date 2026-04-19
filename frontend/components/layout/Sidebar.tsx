"use client";

import { useLanguage } from "@/hooks/useLanguage";
import clsx from "clsx";
import {
  BarChart3,
  FileText,
  Files,
  GitCompareArrows,
  LayoutDashboard,
  Search,
  Settings,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", icon: Search, labelKey: "search" as const },
  { href: "/documents", icon: FileText, labelKey: "documents" as const },
] as const;

const ADMIN_ITEMS = [
  { href: "/admin", icon: LayoutDashboard, labelKey: "dashboard" as const },
  { href: "/admin/library", icon: FileText, labelKey: "documents" as const },
  {
    href: "/admin/cross-references",
    icon: GitCompareArrows,
    labelKey: "crossReferences" as const,
  },
  { href: "/admin/analytics", icon: BarChart3, labelKey: "analytics" as const },
] as const;

interface SidebarProps {
  showAdmin?: boolean;
}

export default function Sidebar({ showAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = showAdmin ? ADMIN_ITEMS : NAV_ITEMS;

  return (
    <aside className="w-56 bg-kpmg-blue-dark text-white min-h-[calc(100vh-52px)] flex flex-col">
      <nav className="flex-1 py-4">
        {items.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-5 py-2.5 text-sm transition",
                isActive
                  ? "bg-white/15 text-white border-s-2 border-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white border-s-2 border-transparent",
              )}
            >
              <item.icon className="w-4.5 h-4.5" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-2 py-2 text-xs text-white/50 hover:text-white/80 transition"
        >
          <Settings className="w-4 h-4" />
          {t("settings")}
        </Link>
      </div>
    </aside>
  );
}
