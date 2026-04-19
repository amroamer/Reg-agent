"use client";

import Link from "next/link";
import { Globe, Search, Settings } from "lucide-react";
import { useState } from "react";

interface EditorialHeaderProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: (q: string) => void;
}

export default function EditorialHeader({
  query,
  onQueryChange,
  onSubmit,
}: EditorialHeaderProps) {
  const [focused, setFocused] = useState(false);

  return (
    <header className="bg-white border-b border-paper-line sticky top-0 z-30">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded bg-ink-soft text-white flex items-center justify-center font-display font-bold text-sm">
            R
          </div>
          <div className="leading-tight">
            <p className="font-display font-semibold text-sm text-ink">
              RegInspector
            </p>
            <p className="text-[10px] text-ink-muted tracking-wide">
              Saudi Arabia · Beta
            </p>
          </div>
        </Link>

        {/* Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) onSubmit(query);
          }}
          className="flex-1 max-w-2xl mx-auto"
        >
          <div
            className={`relative flex items-center rounded-lg border bg-paper-soft transition ${
              focused ? "border-ink-soft bg-white" : "border-paper-line"
            }`}
          >
            <Search className="w-4 h-4 text-ink-muted ms-3 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Search regulations, articles, policies..."
              className="flex-1 px-3 py-2 bg-transparent text-sm text-ink focus:outline-none"
              dir="auto"
            />
            <kbd className="me-3 flex-shrink-0 px-1.5 py-0.5 text-[10px] font-mono text-ink-muted bg-white border border-paper-line rounded">
              ⌘K
            </kbd>
          </div>
        </form>

        {/* Nav */}
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/search"
            className="px-3 py-1.5 text-ink hover:bg-paper-soft rounded font-medium"
          >
            Search
          </Link>
          <Link
            href="/documents"
            className="px-3 py-1.5 text-ink-muted hover:text-ink hover:bg-paper-soft rounded"
          >
            Documents
          </Link>
          <Link
            href="/saved"
            className="px-3 py-1.5 text-ink-muted hover:text-ink hover:bg-paper-soft rounded"
          >
            Saved
          </Link>

          <div className="w-px h-5 bg-paper-line mx-2" />

          <button
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper-soft rounded"
            title="Language"
          >
            <Globe className="w-4 h-4" />
          </button>
          <Link
            href="/settings"
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper-soft rounded"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <Link
            href="/admin"
            className="ms-1 w-7 h-7 rounded-full bg-ink-soft text-white flex items-center justify-center text-[11px] font-medium"
            title="Admin"
          >
            AM
          </Link>
        </nav>
      </div>
    </header>
  );
}
