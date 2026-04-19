"use client";

import {
  BarChart3,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LibraryStats } from "@/lib/types";

interface LibrarySidebarProps {
  stats: LibraryStats;
}

export default function LibrarySidebar({ stats }: LibrarySidebarProps) {
  const pathname = usePathname();

  const workspace = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    {
      href: "/admin/library",
      icon: FileText,
      label: "Documents",
      count: stats.total,
    },
    {
      href: "/admin/cross-references",
      icon: GitCompareArrows,
      label: "Cross-References",
    },
    { href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  ];

  return (
    <aside className="dl-sidebar">
      <div className="dl-nav-section">Workspace</div>
      <div className="dl-nav">
        {workspace.map((i) => {
          const active =
            i.href === "/admin/library"
              ? pathname?.startsWith("/admin/library")
              : pathname === i.href;
          const Icon = i.icon;
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`dl-nav-item ${active ? "active" : ""}`}
            >
              <Icon size={16} />
              <span>{i.label}</span>
              {i.count != null && (
                <span className="dl-nav-count">{i.count}</span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="dl-nav-section" style={{ marginTop: 18 }}>
        Status
      </div>
      <div className="dl-nav">
        <div className="dl-nav-item" style={{ fontSize: 12 }}>
          <span
            className="status-pill indexed"
            style={{ padding: 0, border: 0, background: "transparent" }}
          />
          Indexed
          <span className="dl-nav-count">{stats.indexed}</span>
        </div>
        <div className="dl-nav-item" style={{ fontSize: 12 }}>
          <span
            className="status-pill processing"
            style={{ padding: 0, border: 0, background: "transparent" }}
          />
          Processing
          <span className="dl-nav-count">{stats.processing}</span>
        </div>
        <div className="dl-nav-item" style={{ fontSize: 12 }}>
          <span
            className="status-pill pending"
            style={{ padding: 0, border: 0, background: "transparent" }}
          />
          Pending
          <span className="dl-nav-count">{stats.pending}</span>
        </div>
        <div className="dl-nav-item" style={{ fontSize: 12 }}>
          <span
            className="status-pill failed"
            style={{ padding: 0, border: 0, background: "transparent" }}
          />
          Failed
          <span className="dl-nav-count">{stats.failed}</span>
        </div>
      </div>

      <div className="dl-sidebar-foot">
        <Link href="/settings" className="dl-nav-item">
          <Settings size={14} />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
