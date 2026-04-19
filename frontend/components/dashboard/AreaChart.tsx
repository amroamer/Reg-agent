"use client";

interface AreaChartProps {
  data: number[];
  color?: string;
}

/**
 * Single-series area chart with grid lines, y-axis ticks, day labels,
 * and a "current value" marker on the rightmost point. Ports the SVG
 * from the design's dashboard-app.jsx AreaChart.
 */
export default function AreaChart({
  data,
  color = "var(--primary)",
}: AreaChartProps) {
  const w = 600;
  const h = 200;
  const pad = { t: 12, r: 16, b: 24, l: 32 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  if (!data || data.length === 0) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
        <text
          x={w / 2}
          y={h / 2}
          textAnchor="middle"
          fontSize="12"
          fill="var(--ink-4)"
        >
          No data yet
        </text>
      </svg>
    );
  }

  const max = Math.max(...data) * 1.1 || 1;
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const pts = data.map<[number, number]>((v, i) => [
    pad.l + i * step,
    pad.t + innerH - (v / max) * innerH,
  ]);
  const linePath = "M " + pts.map((p) => p.join(",")).join(" L ");
  const areaPath =
    linePath + ` L ${pad.l + innerW},${pad.t + innerH} L ${pad.l},${pad.t + innerH} Z`;

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((max * i) / tickCount),
  );

  const labelStep = Math.max(1, Math.ceil(data.length / 6));
  const dayLabels: number[] = [];
  for (let i = 0; i < data.length; i += labelStep) dayLabels.push(i);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {yTicks.map((t, i) => {
        const y = pad.t + innerH - (t / max) * innerH;
        return (
          <g key={i}>
            <line
              className="chart-grid"
              x1={pad.l}
              y1={y}
              x2={pad.l + innerW}
              y2={y}
            />
            <text
              className="chart-axis"
              x={pad.l - 6}
              y={y + 3}
              textAnchor="end"
            >
              {t}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill={color} opacity="0.14" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" />
      {pts.map(
        (p, i) =>
          i === pts.length - 1 && (
            <circle
              key={i}
              cx={p[0]}
              cy={p[1]}
              r="3"
              fill={color}
              stroke="white"
              strokeWidth="1.5"
            />
          ),
      )}
      {dayLabels.map((i) => (
        <text
          key={i}
          className="chart-axis"
          x={pad.l + i * step}
          y={h - 6}
          textAnchor="middle"
        >
          d-{data.length - i}
        </text>
      ))}
    </svg>
  );
}
