"use client";

import "./library/library.css";
import "./dashboard.css";

import { useCallback, useEffect, useState } from "react";
import LibrarySidebar from "@/components/library/LibrarySidebar";
import LibraryTopBar from "@/components/library/LibraryTopBar";
import ActivityCard from "@/components/dashboard/ActivityCard";
import {
  SourceCard,
  StatusCard,
  TypesCard,
} from "@/components/dashboard/BreakdownCards";
import FailedCard from "@/components/dashboard/FailedCard";
import HealthCard from "@/components/dashboard/HealthCard";
import KpiCard from "@/components/dashboard/KpiCard";
import QuickActionsCard from "@/components/dashboard/QuickActionsCard";
import TimeSeriesCard from "@/components/dashboard/TimeSeriesCard";
import TopQueriesCard from "@/components/dashboard/TopQueriesCard";
import { useToast } from "@/hooks/useToast";
import api from "@/lib/api";
import type { DashboardResponse, LibraryStats } from "@/lib/types";

type RangeKey = "7d" | "30d" | "90d";

export default function AdminDashboardPage() {
  const toast = useToast();
  const [range, setRange] = useState<RangeKey>("30d");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<DashboardResponse>("/admin/dashboard", {
        params: { range },
      });
      setData(data);
    } catch {
      toast.notify("error", "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [range, toast]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Sidebar derives its counts from status — mirror them through.
  const sidebarStats: LibraryStats = data
    ? {
        total: data.kpis.find((k) => k.id === "docs")?.value ?? 0,
        indexed: data.status.find((s) => s.id === "indexed")?.count ?? 0,
        processing: data.status.find((s) => s.id === "processing")?.count ?? 0,
        pending: data.status.find((s) => s.id === "pending")?.count ?? 0,
        failed: data.status.find((s) => s.id === "failed")?.count ?? 0,
        superseded: 0,
      }
    : {
        total: 0,
        indexed: 0,
        processing: 0,
        pending: 0,
        failed: 0,
        superseded: 0,
      };

  const handleRetry = async (documentId: string) => {
    try {
      await api.post(`/documents/${documentId}/retry`);
      toast.notify("info", "Retry started");
      fetchDashboard();
    } catch {
      toast.notify("error", "Retry failed");
    }
  };

  const handleRetryAll = async () => {
    if (!data) return;
    await Promise.all(
      data.failed.map((f) =>
        api.post(`/documents/${f.document_id}/retry`).catch(() => null),
      ),
    );
    toast.notify("info", `Retrying ${data.failed.length} document(s)`);
    fetchDashboard();
  };

  return (
    <div className="dl-app dash-app">
      <LibraryTopBar />
      <div className="dash-shell">
        <LibrarySidebar stats={sidebarStats} />
        <main className="dash-main">
          <div className="dash-head">
            <div>
              <h1>Dashboard</h1>
              <div className="greeting">
                Welcome back,{" "}
                <b>{data?.user.name || "there"}</b>. Here&apos;s what&apos;s
                happening in your library.
              </div>
            </div>
            <div className="range-toggle" role="tablist" aria-label="Date range">
              {(["7d", "30d", "90d"] as RangeKey[]).map((r) => (
                <button
                  key={r}
                  className={range === r ? "active" : ""}
                  onClick={() => setRange(r)}
                >
                  Last {r.replace("d", " days")}
                </button>
              ))}
            </div>
          </div>

          {loading && !data && (
            <div
              style={{
                padding: "80px 0",
                textAlign: "center",
                color: "var(--ink-4)",
                fontSize: 13,
              }}
            >
              Loading dashboard…
            </div>
          )}

          {data && (
            <>
              {/* KPI row — 4 × col-3 */}
              <div className="dash-grid" style={{ marginBottom: 14 }}>
                {data.kpis.map((k) => (
                  <div key={k.id} className="col-3">
                    <KpiCard k={k} />
                  </div>
                ))}
              </div>

              {/* Ingestion + Quick Actions */}
              <div className="dash-grid" style={{ marginBottom: 14 }}>
                <div className="col-8">
                  <TimeSeriesCard
                    variant="ingestion"
                    data={data.ingestion}
                    rangeDays={data.range_days}
                  />
                </div>
                <div className="col-4">
                  <QuickActionsCard />
                </div>
              </div>

              {/* Source / Status / Health */}
              <div className="dash-grid" style={{ marginBottom: 14 }}>
                <div className="col-5">
                  <SourceCard data={data.source} />
                </div>
                <div className="col-4">
                  <StatusCard data={data.status} />
                </div>
                <div className="col-3">
                  <HealthCard data={data.health} />
                </div>
              </div>

              {/* Searches + Types */}
              <div className="dash-grid" style={{ marginBottom: 14 }}>
                <div className="col-8">
                  <TimeSeriesCard
                    variant="searches"
                    data={data.searches}
                    rangeDays={data.range_days}
                  />
                </div>
                <div className="col-4">
                  <TypesCard data={data.types} />
                </div>
              </div>

              {/* Activity + Top queries */}
              <div className="dash-grid" style={{ marginBottom: 14 }}>
                <div className="col-7">
                  <ActivityCard data={data.activity} />
                </div>
                <div className="col-5">
                  <TopQueriesCard data={data.top_queries} />
                </div>
              </div>

              {/* Failed (full width) */}
              <div className="dash-grid">
                <div className="col-12">
                  <FailedCard
                    data={data.failed}
                    onRetry={handleRetry}
                    onRetryAll={handleRetryAll}
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
