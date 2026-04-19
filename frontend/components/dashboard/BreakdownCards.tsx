"use client";

import { Layers, Tag, Zap } from "lucide-react";
import Donut from "./Donut";
import type { DashboardBucket } from "@/lib/types";

/**
 * Library by source — donut + legend.
 */
export function SourceCard({ data }: { data: DashboardBucket[] }) {
  const total = data.reduce((a, x) => a + x.count, 0) || 1;
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <span className="card-ico">
            <Layers size={12} />
          </span>
          Library by source
        </div>
      </div>
      <div className="donut-wrap">
        <Donut data={data} />
        <div className="donut-legend">
          {data.map((s) => (
            <div key={s.id} className="donut-item">
              <span className="dot" style={{ background: s.color }} />
              <span>{s.label || s.id}</span>
              <span className="num">
                {s.count}
                <span className="pct">{Math.round((s.count / total) * 100)}%</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Processing status — horizontal bar rows.
 */
export function StatusCard({ data }: { data: DashboardBucket[] }) {
  const total = data.reduce((a, s) => a + s.count, 0) || 1;
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <span className="card-ico">
            <Zap size={12} />
          </span>
          Processing status
        </div>
        <a href="/admin/library" className="card-action">
          View queue →
        </a>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.map((s) => (
          <div key={s.id} className="h-bar-row">
            <span className="lbl">
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: s.color,
                  marginRight: 6,
                  verticalAlign: "middle",
                }}
              />
              {s.label || s.id}
            </span>
            <div className="bar-outer">
              <div
                className="bar-inner"
                style={{
                  width: `${(s.count / total) * 100}%`,
                  background: s.color,
                }}
              />
            </div>
            <span className="val">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * By document type — horizontal bar rows.
 */
export function TypesCard({ data }: { data: DashboardBucket[] }) {
  const total = data.reduce((a, s) => a + s.count, 0) || 1;
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <span className="card-ico">
            <Tag size={12} />
          </span>
          By document type
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.map((s) => (
          <div key={s.id} className="h-bar-row">
            <span className="lbl">{s.id}</span>
            <div className="bar-outer">
              <div
                className="bar-inner"
                style={{
                  width: `${(s.count / total) * 100}%`,
                  background: s.color,
                }}
              />
            </div>
            <span className="val">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
