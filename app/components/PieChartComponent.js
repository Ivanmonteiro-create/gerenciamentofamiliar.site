"use client";
import React from "react";

/**
 * PieChartComponent — Donut (SVG) sem libs externas.
 * Props:
 *  - labels: string[]
 *  - values: number[]
 *  - size?: number (px) -> default 260
 *  - innerRadius?: number (0..0.95) -> fração do raio para formar o “furo” do donut
 *  - colors?: string[] (hex/rgb)
 */
export default function PieChartComponent({
  labels = [],
  values = [],
  size = 260,
  innerRadius = 0.62,
  colors = [
    "#16a34a", "#22c55e", "#4ade80", "#86efac",
    "#34d399", "#10b981", "#059669", "#047857",
  ],
}) {
  const total = values.reduce((a, b) => a + (isFinite(b) ? b : 0), 0);
  const radius = size / 2;
  const strokeWidth = Math.max(8, Math.floor(size * (1 - innerRadius)));
  const r = radius - strokeWidth / 2;

  // Sem dados → donut “vazio” e mensagem
  if (!total) {
    return (
      <div style={{ width: size, height: size, display: "grid", placeItems: "center" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={radius} cy={radius} r={r} stroke="#e5e7eb" strokeWidth={strokeWidth} fill="none" />
        </svg>
        <small style={{ color: "#9ca3af", marginTop: -size * 0.18 }}>Sem dados</small>
      </div>
    );
  }

  // Cria os arcos como “stroked circles” usando strokeDasharray/offset
  const circumference = 2 * Math.PI * r;
  let acc = 0;

  const segments = values.map((v, i) => {
    const frac = total ? Math.max(0, v) / total : 0;
    const len = circumference * frac;
    const dashArray = `${len} ${circumference - len}`;
    const dashOffset = -acc;
    acc += len;
    return (
      <circle
        key={i}
        cx={radius}
        cy={radius}
        r={r}
        fill="none"
        stroke={colors[i % colors.length]}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
        strokeDashoffset={dashOffset}
        style={{ transition: "stroke-dashoffset .4s ease, stroke .2s ease" }}
      />
    );
  });

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.08))" }}>
        {/* fundo */}
        <circle cx={radius} cy={radius} r={r} stroke="#e5e7eb" strokeWidth={strokeWidth} fill="none" />
        {segments}
      </svg>

      {/* legenda minimalista */}
      <div style={{ display: "grid", gap: 8 }}>
        {labels.map((lbl, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: colors[i % colors.length] }} />
            <span>{lbl}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
