"use client";

import { Globe, Search, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Top bar for the Document Library chrome — ported from the Claude Design
 * handoff (reg-inspector-agent/project/doclib-app.jsx).
 * The styling lives in app/admin/library/library.css under the `.dl-app` scope.
 */
export default function LibraryTopBar() {
  const pathname = usePathname();
  const isDocs = pathname?.startsWith("/admin/library") || pathname?.startsWith("/documents");
  const isSearch = pathname === "/" || pathname?.startsWith("/search");
  const isSaved = pathname?.startsWith("/saved");

  return (
    <header className="topbar">
      <Link href="/admin/library" className="brand" style={{ textDecoration: "none" }}>
        <div className="brand-mark">R</div>
        <div>
          <div className="brand-name">RegInspector</div>
          <div className="brand-sub">Saudi Arabia · Admin</div>
        </div>
      </Link>

      <div className="topbar-search">
        <span style={{ color: "var(--ink-3)", display: "inline-flex" }}>
          <Search size={16} />
        </span>
        <input placeholder="Search regulations, circulars, policies…" readOnly />
        <span className="kbd">⌘K</span>
      </div>

      <div className="topbar-right">
        <Link href="/" className={`nav-link ${isSearch ? "active" : ""}`}>
          Search
        </Link>
        <Link href="/admin/library" className={`nav-link ${isDocs ? "active" : ""}`}>
          Documents
        </Link>
        <Link href="/saved" className={`nav-link ${isSaved ? "active" : ""}`}>
          Saved
        </Link>
        <div
          style={{
            width: 1,
            height: 22,
            background: "var(--border)",
            margin: "0 6px",
          }}
        />
        <button className="icon-btn" aria-label="Language">
          <Globe size={16} />
        </button>
        <Link href="/settings" className="icon-btn" aria-label="Settings">
          <Settings size={16} />
        </Link>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#6B7CB3,#2B3A6E)",
            color: "white",
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            fontWeight: 600,
            marginLeft: 4,
          }}
        >
          AM
        </div>
      </div>
    </header>
  );
}
