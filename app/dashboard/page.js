"use client";

import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "../components/ThemeToggle";

/* =================== Utilidades =================== */

const STORAGE_KEY = "gf_transactions_v1"; // mesma chave usada nas outras telas

function monthKey(d) {
  // retorna "YYYY-MM"
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = (dt.getMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}
function fmtMonthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
}
function currency(n) {
  return (n || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

/* =================== Componentes simples de gráfico =================== */

// Pizza simples em SVG (percentuais por categoria)
function DonutChart({ data, total, emptyLabel = "Sem dados" }) {
  if (!data.length || total <= 0.0001) {
    return (
      <div style={{ height: 220, display: "grid", placeItems: "center", color: "var(--mutedText,#6b7280)" }}>
        {emptyLabel}
      </div>
    );
  }
  const radius = 80;
  const circ = 2 * Math.PI * radius;
  let acc = 0;
  const palette = ["#22c55e", "#06b6d4", "#f59e0b", "#a78bfa", "#e11d48", "#14b8a6", "#84cc16", "#f97316"];

  return (
    <svg viewBox="0 0 220 220" width="100%" height="220" style={{ display: "block", margin: "0 auto" }}>
      <g transform="translate(110,110)">
        {/* trilho */}
        <circle r={radius} fill="none" stroke="var(--ring,#e5e7eb)" strokeWidth="22" />
        {data.map((it, i) => {
          const frac = it.value / total;
          const dash = frac * circ;
          const gap = circ - dash;
          const rot = (acc / total) * 360;
          acc += it.value;
          return (
            <circle
              key={it.name + i}
              r={radius}
              fill="none"
              stroke={palette[i % palette.length]}
              strokeWidth="22"
              strokeDasharray={`${dash} ${gap}`}
              transform={`rotate(${rot - 90})`}
              strokeLinecap="butt"
            />
          );
        })}
        <text y="6" textAnchor="middle" fontWeight="700" style={{ fill: "var(--cardText,#111827)" }}>
          {currency(total)}
        </text>
      </g>
    </svg>
  );
}

// Barras verticais simples (evolução últimos 6 meses)
function Bars6({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, height: 180, alignItems: "end" }}>
      {data.map((d) => {
        const h = (d.value / max) * 160;
        return (
          <div key={d.label} style={{ display: "grid", justifyItems: "center", gap: 6 }}>
            <div style={{ width: "100%", height: h, background: "var(--bar,#22c55e)", borderRadius: 8 }} />
            <div style={{ fontSize: 12, color: "var(--mutedText,#6b7280)" }}>{d.label.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* =================== Página =================== */

export default function Dashboard() {
  // estado do mês atual
  const todayKey = monthKey(new Date());
  const [refMonth, setRefMonth] = useState(todayKey);
  const [onlyPaid, setOnlyPaid] = useState(true);

  // carrega transações do localStorage
  const [txs, setTxs] = useState([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setTxs(raw ? JSON.parse(raw) : []);
    } catch {
      setTxs([]);
    }
  }, []);

  // filtra por mês e status (pago/pendente)
  const monthTxs = useMemo(() => {
    return txs.filter((t) => {
      const sameMonth = monthKey(t.date) === refMonth;
      const statusOk = onlyPaid ? (t.status ? t.status === "pago" || t.pago === true : t.pago === true) : true;
      return sameMonth && statusOk;
    });
  }, [txs, refMonth, onlyPaid]);

  // kpis
  const entradas = useMemo(
    () => monthTxs.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.value || t.amount || 0), 0),
    [monthTxs]
  );
  const saidas = useMemo(
    () => monthTxs.filter((t) => t.type === "saída" || t.type === "saida").reduce((s, t) => s + Number(t.value || t.amount || 0), 0),
    [monthTxs]
  );
  const saldo = useMemo(() => entradas - saidas, [entradas, saidas]);

  // pizza: despesas por categoria
  const pieData = useMemo(() => {
    const map = new Map();
    monthTxs
      .filter((t) => t.type === "saída" || t.type === "saida")
      .forEach((t) => {
        const c = (t.category || t.categoria || "Outros").toString();
        map.set(c, (map.get(c) || 0) + Number(t.value || t.amount || 0));
      });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [monthTxs]);
  const pieTotal = useMemo(() => pieData.reduce((s, i) => s + i.value, 0), [pieData]);

  // evolução 6 meses (saldo)
  const last6 = useMemo(() => {
    const base = new Date(refMonth + "-01T00:00:00");
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base);
      d.setMonth(d.getMonth() - i);
      const key = monthKey(d);
      months.push(key);
    }
    return months.map((key) => {
      const mtx = txs.filter((t) => monthKey(t.date) === key && (onlyPaid ? (t.status ? t.status === "pago" || t.pago === true : t.pago === true) : true));
      const ent = mtx.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.value || t.amount || 0), 0);
      const sai = mtx.filter((t) => t.type === "saída" || t.type === "saida").reduce((s, t) => s + Number(t.value || t.amount || 0), 0);
      return { label: key, value: ent - sai };
    });
  }, [txs, refMonth, onlyPaid]);

  // lista de opções de mês (dos dados)
  const monthOptions = useMemo(() => {
    const set = new Set(txs.map((t) => monthKey(t.date)));
    const arr = Array.from(set).sort(); // crescente
    if (!arr.includes(todayKey)) arr.push(todayKey);
    return arr;
  }, [txs]);

  return (
    <div style={{ padding: 16 }}>
      {/* ==== Cabeçalho (botão à esquerda do título) ==== */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <ThemeToggle />
        <h1 style={{ margin: 0 }}>Dashboard</h1>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* filtro de mês */}
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--mutedText,#6b7280)" }}>Mês:</span>
            <select
              value={refMonth}
              onChange={(e) => setRefMonth(e.target.value)}
              style={{
                padding: "6px 10px",
                border: "1px solid var(--bd,#e5e7eb)",
                borderRadius: 8,
                background: "var(--field,#fff)",
              }}
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {fmtMonthLabel(m)}
                </option>
              ))}
            </select>
          </label>

          {/* apenas pagos */}
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={onlyPaid} onChange={(e) => setOnlyPaid(e.target.checked)} />
            <span style={{ fontSize: 12 }}>Considerar apenas pagos</span>
          </label>
        </div>
      </div>

      {/* ==== KPIs ==== */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 12 }}>
        <div className="card" style={card()}>
          <div style={{ fontSize: 13, color: "var(--mutedText,#6b7280)" }}>Despesas por categoria ({fmtMonthLabel(refMonth)})</div>
          <DonutChart data={pieData} total={pieTotal} />
          {pieData.length > 0 && (
            <ul style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 6, marginTop: 6 }}>
              {pieData.map((p) => (
                <li key={p.name} style={{ fontSize: 12, color: "var(--mutedText,#6b7280)" }}>
                  {p.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div className="card" style={card()}>
            <div style={{ fontSize: 12, color: "var(--mutedText,#6b7280)" }}>Entradas</div>
            <div style={kpi()}>{currency(entradas)}</div>
          </div>
          <div className="card" style={card()}>
            <div style={{ fontSize: 12, color: "var(--mutedText,#6b7280)" }}>Saídas</div>
            <div style={kpi()}>{currency(saidas)}</div>
          </div>
          <div className="card" style={card()}>
            <div style={{ fontSize: 12, color: "var(--mutedText,#6b7280)" }}>Saldo</div>
            <div style={kpi(saldo >= 0 ? "ok" : "bad")}>{currency(saldo)}</div>
          </div>
        </div>
      </div>

      {/* ==== Evolução 6 meses ==== */}
      <div className="card" style={card()}>
        <div style={{ fontSize: 13, color: "var(--mutedText,#6b7280)", marginBottom: 6 }}>Evolução (últimos 6 meses)</div>
        <Bars6 data={last6} />
      </div>
    </div>
  );
}

/* =================== Estilos helpers =================== */

function card() {
  return {
    background: "var(--card,#fff)",
    color: "var(--cardText,#111827)",
    border: "1px solid var(--bd,#e5e7eb)",
    borderRadius: 16,
    padding: 14,
    boxShadow: "0 1px 2px rgba(0,0,0,.04)",
  };
}
function kpi(mode) {
  const color =
    mode === "ok" ? "var(--ok,#059669)" : mode === "bad" ? "var(--bad,#dc2626)" : "var(--cardText,#111827)";
  return { fontSize: 24, fontWeight: 700, color };
}
