"use client";

import { useLanguage } from "@/hooks/useLanguage";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  const { t } = useLanguage();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {t("analytics")}
      </h1>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-600 mb-2">
          Search Analytics
        </h2>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          Search volume trends, popular queries, average response times, and
          document usage analytics will appear here once search data
          accumulates.
        </p>
      </div>
    </div>
  );
}
