"use client";

import "./library.css";
import LibraryTopBar from "@/components/library/LibraryTopBar";

/**
 * Dedicated chrome for the Document Library — ports the design from the
 * Claude Design handoff. This layout replaces the default admin chrome
 * (see frontend/app/admin/layout.tsx which conditionally skips itself
 * for /admin/library/*). The page component renders its own sidebar so
 * it can pass the live LibraryStats in.
 */
export default function AdminLibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dl-app">
      <LibraryTopBar />
      {children}
    </div>
  );
}
