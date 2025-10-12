"use client";

import { useEffect, useMemo, useState } from "react";
import categorias from "../data/categorias.json";

/** ====== helpers ====== **/
const STORAGE_KEY = "gf_transactions_v2";
const THEME_KEY = "gf_theme"; // "neutral" | "dark"

function loadTransactions() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function currency(n) {
  try {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
  } catch {
    return Number(n ?? 0).toFixed(2);
  }
}

function ym(dateStr) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}
function monthLabel(ymStr) {
  const [y, m] = ymStr.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" });
}
function lastNMonths(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    out.unshift(`${y}-${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

/** ====== Gráfico de Pizza (SVG) ====== **/
function PieChart({ data, size = 220, inner = 70, colors = [] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  let angle = -Math.PI / 2;

  function donutPath(cx, cy, rOuter, rInner, start, end) {
    const x1 = cx + rOuter * Math.cos(start);
    const y1 = cy + rOuter * Math.sin(start);
    const x2 = cx + rOuter * Math.cos(end);
    const y2 = cy + rOuter * Math.sin(end);
    const x3 = cx + rInner * Math.cos(end);
    const y3 = cy + rInner * Math.sin(end);
    const x4 = cx + rInner * Math.cos(start);
    const y4 = cy + rInner * Math.sin(start);
    const large = end - start > Math.PI ? 1 : 0;
    return [
      `M ${x1} ${y1}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4}`,
      "Z",
    ].join(" ");
  }

  if (total <= 0) {
    return (
      <div className="empty">
        Sem dados para o período selecionado.
        <style jsx>{`
          .empty { display:flex; align-items:center; justify-content:center; height:${size}px; color:#6b7280; font-size:14px; background:#fafafa; border:1px dashed #e5e7eb; border-radius:12px; }
        `}</style>
      </div>
    );
  }

  let current = -Math.PI / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d, i) => {
        const frac = d.value / total;
        const start = current;
        const end = current + frac * Math.PI * 2;
        current = end;
        const fill = colors[i % colors.length] || "#94a3b8";
        return <path key={d.label} d={donutPath(cx, cy, r, inner, start, end)} fill={fill} stroke="white" strokeWidth="1" />;
      })}
    </svg>
  );
}

/** ====== Gráfico de Barras (SVG) ====== **/
function Bars({ series, width = 560, height = 220 }) {
  const padding = { top: 10, right: 12, bottom: 28, left: 12 };
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;
  const maxVal = Math.max(1, ...series.map(s => Math.abs(s.value)));
  const xStep = w / series.length;

  return (
    <svg width={width} height={height}>
      <g transform={`translate(${padding.left},${padding.top})`}>
        <line x1="0" y1={h/2} x2={w} y2={h/2} stroke="#e5e7eb" />
        {series.map((s, i) => {
          const x = i * xStep + xStep * 0.15;
          const barW = xStep * 0.7;
          const y0 = h / 2;
          const barH = (Math.abs(s.value) / maxVal) * (h / 2 - 8);
          const isPos = s.value >= 0;
          const y = isPos ? y0 - barH : y0;
          return (
            <g key={s.label}>
              <rect x={x} y={y} width={barW} height={barH} fill={isPos ? "#16a34a" : "#dc2626"} rx="4" />
              <text x={x + barW / 2} y={h + 16} textAnchor="middle" fontSize="11" fill="#374151">{s.short}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** ====== Botão de tema (neutral ↔ dark) ====== **/
function ThemeToggle() {
  const [theme, setTheme] = useState("neutral"); // neutral | dark

  useEffect(() => {
    // carrega preferência salva
    const saved = typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null;
    const initial = saved === "dark" ? "dark" : "neutral";
    setTheme(initial);
    if (initial === "dark") {
      document.body.classList.add("theme-dark");
    } else {
      document.body.classList.remove("theme-dark");
    }
  }, []);

  function toggle() {
    const next = theme === "dark" ? "neutral" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    if (next === "dark") {
      document.body.classList.add("theme-dark");
    } else {
      document.body.classList.remove("theme-dark");
    }
  }

  return (
    <button
      className="btn-sm"
      onClick={toggle}
      aria-label="Alternar tema"
      title={theme === "dark" ? "Tema escuro ativo — clicar para neutro" : "Tema neutro ativo — clicar para escuro"}
      style={{ whiteSpace: "nowrap" }}
    >
      {theme === "dark" ? "🌞 Claro" : "🌙 Escuro"}
    </button>
  );
}

/** ====== Página ====== **/
export default function Dashboard() {
  const [txs, setTxs] = useState([]);
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [apenasPagos, setApenasPagos] = useState(true);

  useEffect(() => {
    setTxs(loadTransactions());
  }, []);

  const txsFiltradas = useMemo(() => {
    return txs.filter(t => {
      const okMes = mes ? t.data.startsWith(mes) : true;
      const okStatus = apenasPagos ? t.status === "pago" : true;
      return okMes && okStatus;
    });
  }, [txs, mes, apenasPagos]);

  const entradaMes = useMemo(() => txsFiltradas.filter(t => t.tipo === "entrada").reduce((s,t)=>s+t.valor,0), [txsFiltradas]);
  const saidaMes   = useMemo(() => txsFiltradas.filter(t => t.tipo === "saída").reduce((s,t)=>s+t.valor,0), [txsFiltradas]);
  const saldoMes   = entradaMes - saidaMes;

  const despesasPorCategoria = useMemo(() => {
    const map = new Map();
    txsFiltradas.filter(t => t.tipo === "saída").forEach(t => {
      map.set(t.categoria, (map.get(t.categoria) || 0) + t.valor);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a,b)=>b.value - a.value);
  }, [txsFiltradas]);

  const ultimos = useMemo(() => {
    const months = lastNMonths(6);
    const set = new Set(months);
    const filtered = txs.filter(t => (apenasPagos ? t.status === "pago" : true) && set.has(ym(t.data)));
    return months.map(m => {
      const entradas = filtered.filter(t => ym(t.data) === m && t.tipo === "entrada").reduce((s,t)=>s+t.valor,0);
      const saidas   = filtered.filter(t => ym(t.data) === m && t.tipo === "saída").reduce((s,t)=>s+t.valor,0);
      return { label: m, short: monthLabel(m), value: entradas - saidas };
    });
  }, [txs, apenasPagos]);

  const COLORS = ["#16a34a", "#22c55e", "#a3e635", "#2563eb", "#60a5fa", "#0ea5e9", "#06b6d4", "#f59e0b", "#f97316", "#ef4444", "#a855f7", "#ec4899"];

  return (
    <div className="wrap">
      <div className="head">
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <div className="head-actions">
          <ThemeToggle />
        </div>
      </div>

      <div className="filters">
        <div>
          <label className="lbl">Mês</label>
          <input className="inp" type="month" value={mes} onChange={(e)=>setMes(e.target.value)} />
        </div>
        <div style={{ alignSelf:"end" }}>
          <label className="check">
            <input type="checkbox" checked={apenasPagos} onChange={e=>setApenasPagos(e.target.checked)} />
            Considerar apenas pagos
          </label>
        </div>
      </div>

      {/* cards resumo */}
      <div className="cards">
        <div className="card in">
          <div className="c-title">Entradas</div>
          <div className="c-value">{currency(entradaMes)}</div>
        </div>
        <div className="card out">
          <div className="c-title">Saídas</div>
          <div className="c-value">{currency(saidaMes)}</div>
        </div>
        <div className={`card ${saldoMes >= 0 ? "ok" : "neg"}`}>
          <div className="c-title">Saldo</div>
          <div className="c-value">{currency(saldoMes)}</div>
        </div>
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panel-head">
            <h3>Despesas por categoria ({mes})</h3>
          </div>
          <div className="pie-row">
            <PieChart
              data={despesasPorCategoria.map((d) => ({ label: d.label, value: d.value }))}
              size={260}
              inner={80}
              colors={COLORS}
            />
            <div className="legend">
              {despesasPorCategoria.slice(0, 10).map((d, i) => (
                <div key={d.label} className="legend-item">
                  <span className="dot" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="name">{d.label}</span>
                  <span className="val">{currency(d.value)}</span>
                </div>
              ))}
              {despesasPorCategoria.length === 0 && (
                <div className="muted">Sem despesas neste mês.</div>
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Evolução (últimos 6 meses)</h3>
            <small className="muted">{apenasPagos ? "Apenas pagos" : "Pagos + pendentes"}</small>
          </div>
          <div className="bars-wrap">
            <Bars series={ultimos} width={560} height={240} />
          </div>
        </div>
      </div>

      <style jsx>{`
        .wrap{max-width:1120px;margin:0 auto;padding:16px;}
        .head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;}
        .head-actions{display:flex;gap:8px;align-items:center;}
        .filters{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-top:6px;}
        .lbl{display:block;font-size:12px;color:#6b7280;margin-bottom:6px;}
        .inp{padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;}
        .check{font-size:14px;color:#374151;display:flex;gap:8px;align-items:center;}

        .cards{display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:12px;margin-top:10px;}
        .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;box-shadow:0 1px 2px rgba(0,0,0,.04);}
        .card.in{border-color:#16a34a33;}
        .card.out{border-color:#dc262633;}
        .card.ok{border-color:#2563eb33;}
        .card.neg{border-color:#dc262633;}
        .c-title{color:#374151;font-size:13px;font-weight:700;margin-bottom:4px;}
        .c-value{font-weight:800;font-size:20px;}

        .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;}
        @media(max-width:1000px){ .grid{grid-template-columns:1fr;} }

        .panel{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;}
        .panel-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;}
        .panel h3{margin:0;}
        .muted{color:#6b7280;}

        .pie-row{display:flex;gap:16px;align-items:center;justify-content:center;flex-wrap:wrap;}
        .legend{min-width:240px;flex:1;max-width:440px;}
        .legend-item{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid #f3f4f6;}
        .legend-item:last-child{border-bottom:none;}
        .dot{width:10px;height:10px;border-radius:999px;display:inline-block;}
        .name{color:#374151;font-size:14px;}
        .val{font-weight:700;font-size:14px;text-align:right;}

        .bars-wrap{overflow:auto;}
      `}</style>
    </div>
  );
}
