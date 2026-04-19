"use client";

interface SparklineProps {
  data: number[];
  color?: string;
  fill?: boolean;
}

/**
 * Mini sparkline chart used inside KPI cards. Ports the SVG from the
 * design's dashboard-app.jsx Sparkline.
 */
export default function Sparkline({
  data,
  color = "var(--primary)",
  fill = true,
}: SparklineProps) {
  const w = 100;
  const h = 28;
  if (!data || data.length < 2) {
    return <svg className="spark" viewBox={`0 0 ${w} ${h}`} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map<[number, number]>((v, i) => [
    i * step,
    h - ((v - min) / range) * (h - 4) - 2,
  ]);
  const path = "M " + pts.map((p) => p.join(",")).join(" L ");
  const area = path + ` L ${w},${h} L 0,${h} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {fill && <path d={area} fill={color} opacity="0.12" />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
