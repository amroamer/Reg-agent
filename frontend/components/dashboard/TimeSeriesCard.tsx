"use client";

import { Search, Upload } from "lucide-react";
import AreaChart from "./AreaChart";

interface TimeSeriesCardProps {
  variant: "ingestion" | "searches";
  data: number[];
  rangeDays: number;
}

const META = {
  ingestion: {
    icon: Upload,
    title: "Document ingestion",
    color: "var(--sama)",
    sub: (days: number) => `Documents added per day · last ${days} days`,
  },
  searches: {
    icon: Search,
    title: "Search volume",
    color: "var(--cma)",
    sub: (days: number) => `Queries per day · last ${days} days`,
  },
};

export default function TimeSeriesCard({
  variant,
  data,
  rangeDays,
}: TimeSeriesCardProps) {
  const m = META[variant];
  const Icon = m.icon;
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">
            <span className="card-ico">
              <Icon size={12} />
            </span>
            {m.title}
          </div>
          <div className="card-sub">{m.sub(rangeDays)}</div>
        </div>
        <button className="card-action">Details →</button>
      </div>
      <div className="chart-wrap">
        <AreaChart data={data} color={m.color} />
      </div>
    </div>
  );
}
