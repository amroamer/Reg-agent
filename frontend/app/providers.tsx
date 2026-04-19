"use client";

import { I18nProvider } from "@/lib/i18n/context";
import { ToastProvider } from "@/hooks/useToast";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ToastProvider>{children}</ToastProvider>
    </I18nProvider>
  );
}
