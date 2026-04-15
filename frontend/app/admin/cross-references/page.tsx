"use client";

import { useLanguage } from "@/hooks/useLanguage";
import { GitCompareArrows } from "lucide-react";

export default function CrossReferencesPage() {
  const { t } = useLanguage();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {t("crossReferences")}
      </h1>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <GitCompareArrows className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-600 mb-2">
          Cross-Reference Verification
        </h2>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          After documents are ingested, the system automatically detects
          cross-references between SAMA regulations, CMA rules, and bank
          policies. Review and verify suggested references here.
        </p>
      </div>
    </div>
  );
}
