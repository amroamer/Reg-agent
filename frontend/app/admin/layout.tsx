"use client";

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // The Document Library is designed to occupy the full viewport with its
  // own top bar + sidebar (ported from the Claude Design handoff). Skip the
  // default admin chrome here so the library's shell isn't double-rendered.
  const ownsChrome = pathname?.startsWith("/admin/library");

  if (ownsChrome) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar showAdmin />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
