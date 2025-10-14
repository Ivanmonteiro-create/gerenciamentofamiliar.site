"use client";
import React from "react";

/**
 * BarChartComponent — Barras (SVG) sem libs externas.
 * Props:
 *  - labels: string[]
 *  - values: number[]
 *  - width?: number, height?: number
 */
export default function BarChartComponent({
  labels = [],
  values = [],
  width = 520,
  height = 220,
}) {
  const max = Math.max(1, ...values.map(v => (isFinite(v) ? v : 0)));
  const padding = 28;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;
  const barW = Math.max(12, chartW / Math.max(1, values.length) * 0.6);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {/* eixo Y “zero” */}
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" />
      {/* barras */}
      {values.map((v, i) => {
        const x = padding + i * (chartW / Math.max(1, values.length)) + (chartW / Math.max(1, values.length) - barW) / 2;
        const h = Math.max(0, (v / max) * chartH);
        const y = height - padding - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx="4" fill="#22c55e" />
            <text x={x + barW / 2} y={height - padding + 16} textAnchor="middle" fontSize="11" fill="#6b7280">
              {labels[i] ?? ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
