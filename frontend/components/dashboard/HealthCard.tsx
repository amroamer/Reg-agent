"use client";

import { Zap } from "lucide-react";
import type { DashboardHealth } from "@/lib/types";

interface HealthCardProps {
  data: DashboardHealth[];
}

export default function HealthCard({ data }: HealthCardProps) {
  const allOk = data.every((h) => h.state === "ok");
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <span className="card-ico">
            <Zap size={12} />
          </span>
          System health
        </div>
        <span
          style={{
            fontSize: 11,
            color: allOk ? "oklch(58% 0.13 160)" : "oklch(68% 0.13 70)",
            fontWeight: 600,
          }}
        >
          ● {allOk ? "All systems operational" : "Some services degraded"}
        </span>
      </div>
      <div>
        {data.map((h) => (
          <div className="health-row" key={h.label}>
            <span className="hl-label">{h.label}</span>
            <span className="hl-value">
              <span className={`hl-dot ${h.state}`} />
              {h.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
