"use client";

import type { DashboardBucket } from "@/lib/types";

interface DonutProps {
  data: DashboardBucket[];
  size?: number;
}

/**
 * Donut chart with center total. Each segment is a stroke-dasharray-driven
 * arc. Ports the SVG from the design's dashboard-app.jsx Donut.
 */
export default function Donut({ data, size = 120 }: DonutProps) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--bg-sunken)"
        strokeWidth="14"
      />
      {total > 0 &&
        data.map((d) => {
          const frac = d.count / total;
          const len = C * frac;
          const el = (
            <circle
              key={d.id}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += len;
          return el;
        })}
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        fontSize="22"
        fontWeight="600"
        fill="var(--ink)"
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fontSize="10"
        fill="var(--ink-3)"
      >
        total
      </text>
    </svg>
  );
}
