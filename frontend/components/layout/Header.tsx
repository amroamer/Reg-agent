"use client";

import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import LanguageToggle from "@/components/shared/LanguageToggle";
import { Shield, LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";

export default function Header() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  return (
    <header className="bg-kpmg-blue text-white sticky top-0 z-50">
      <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo & Brand */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition">
          <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold tracking-tight">KPMG</span>
              <span className="text-xs text-white/60">Saudi Arabia</span>
            </div>
            <p className="text-[11px] text-white/70 leading-tight">
              RegInspector — مُفتِّش الأنظمة
            </p>
          </div>
        </Link>

        {/* Nav + Actions */}
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg text-sm hover:bg-white/10 transition"
          >
            {t("search")}
          </Link>
          <Link
            href="/documents"
            className="px-3 py-1.5 rounded-lg text-sm hover:bg-white/10 transition"
          >
            {t("documents")}
          </Link>
          {user?.role === "admin" && (
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-lg text-sm hover:bg-white/10 transition"
            >
              {t("admin")}
            </Link>
          )}

          <div className="w-px h-5 bg-white/20 mx-2" />

          <LanguageToggle />

          {user && (
            <div className="flex items-center gap-2 ms-2">
              <span className="text-xs text-white/70 flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5" />
                {user.name}
              </span>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
                title={t("logout")}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
