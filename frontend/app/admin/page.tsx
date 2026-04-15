"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import api from "@/lib/api";
import type { AdminStats } from "@/lib/types";
import {
  FileText,
  Layers,
  Search,
  GitCompareArrows,
  Loader2,
} from "lucide-react";

const STAT_CARDS = [
  { key: "totalDocuments", icon: FileText, color: "text-kpmg-blue" },
  { key: "totalChunks", icon: Layers, color: "text-kpmg-purple" },
  { key: "totalSearches", icon: Search, color: "text-kpmg-teal" },
  { key: "pendingReview", icon: GitCompareArrows, color: "text-kpmg-green" },
] as const;

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data } = await api.get<AdminStats>("/admin/stats");
        setStats(data);
      } catch {
        // Fallback with zeros
        setStats({
          total_documents: 0,
          documents_by_source: {},
          documents_by_status: {},
          total_chunks: 0,
          total_searches: 0,
          pending_cross_refs: 0,
        });
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-kpmg-blue" />
      </div>
    );
  }

  const statValues = [
    stats?.total_documents ?? 0,
    stats?.total_chunks ?? 0,
    stats?.total_searches ?? 0,
    stats?.pending_cross_refs ?? 0,
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {t("dashboard")}
      </h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map((card, i) => (
          <div
            key={card.key}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {statValues[i].toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">{t(card.key)}</p>
          </div>
        ))}
      </div>

      {/* Documents by Source */}
      {stats?.documents_by_source && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">
            Documents by Source
          </h2>
          <div className="flex gap-6">
            {Object.entries(stats.documents_by_source).map(([source, count]) => (
              <div key={source} className="text-center">
                <p className="text-3xl font-bold text-gray-900">{count}</p>
                <p className="text-sm text-gray-500">{source}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents by Status */}
      {stats?.documents_by_status && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">
            Documents by Status
          </h2>
          <div className="flex gap-6">
            {Object.entries(stats.documents_by_status).map(
              ([status, count]) => (
                <div key={status} className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{count}</p>
                  <p className="text-sm text-gray-500 capitalize">{status}</p>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
