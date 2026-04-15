"use client";

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
