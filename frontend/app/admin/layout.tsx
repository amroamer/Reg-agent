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

  // The Dashboard and Document Library are designed to occupy the full
  // viewport with their own top bar + sidebar (ported from the Claude
  // Design handoff). Skip the default admin chrome on those routes so the
  // shells aren't double-rendered.
  const ownsChrome =
    pathname === "/admin" || pathname?.startsWith("/admin/library");

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
