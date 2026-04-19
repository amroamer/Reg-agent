"use client";

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  Search,
} from "lucide-react";
import Sparkline from "./Sparkline";
import type { DashboardKpi } from "@/lib/types";

interface KpiCardProps {
  k: DashboardKpi;
}

const ICONS = {
  doc: FileText,
  stack: Layers,
  search: Search,
  alert: AlertTriangle,
};

export default function KpiCard({ k }: KpiCardProps) {
  const isWarn = k.tone === "warn";
  // For warning KPIs (e.g. "needs attention"), an INCREASE is bad → red.
  // For normal KPIs, an increase is good → green.
  const deltaCls =
    k.delta > 0 ? (isWarn ? "down" : "up") : k.delta < 0 ? (isWarn ? "up" : "down") : "flat";
  const Arrow = k.delta > 0 ? ChevronUp : ChevronDown;
  const Icon = ICONS[k.icon as keyof typeof ICONS] ?? FileText;

  return (
    <div className="card kpi">
      <div className="kpi-label">
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: isWarn ? "#fdeae6" : "var(--primary-soft)",
            color: isWarn ? "#b42818" : "var(--primary)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon size={11} />
        </span>
        {k.label}
      </div>
      <div className="kpi-value">{k.value.toLocaleString()}</div>
      <Sparkline
        data={k.trend}
        color={isWarn ? "#b42818" : "var(--primary)"}
      />
      <div className="kpi-foot">
        {k.delta !== 0 && (
          <span className={`delta ${deltaCls}`}>
            <Arrow size={10} strokeWidth={3} />
            {Math.abs(k.delta)}
            {k.delta_unit || ""}
          </span>
        )}
        <span>{k.delta_label}</span>
      </div>
    </div>
  );
}
