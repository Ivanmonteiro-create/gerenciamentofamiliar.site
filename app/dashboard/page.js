"use client";

import React, { useEffect, useMemo, useState } from "react";
import PieChartComponent from "../components/PieChartComponent";
import BarChartComponent from "../components/BarChartComponent";

// Meses helper (últimos 6, incluindo o atual)
function lastMonthsLabels(count = 6, locale = "pt-PT") {
  const out = [];
  const d = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(
      dt.toLocaleDateString(locale, { month: "2-digit" }) + "/" + String(dt.getFullYear()).slice(-2)
    );
  }
  return out;
}

const STORAGE_KEY = "gf_transactions_v1"; // mesma chave usada no módulo de Despesas & Receitas

export default function DashboardPage() {
  const [onlyPaid, setOnlyPaid] = useState(true);
  const [monthRef, setMonthRef] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // "YYYY-MM"
  });

  // Carrega lançamentos locais
  const transactions = useMemo(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  // Filtro por mês + status
  const filtered = useMemo(() => {
    const [y, m] = monthRef.split("-").map(Number);
    return transactions.filter((t) => {
      try {
        const dt = new Date(t.date);
        const sameMonth = dt.getFullYear() === y && dt.getMonth() + 1 === m;
        const statusOk = onlyPaid ? (t.status || "").toLowerCase() === "pago" : true;
        return sameMonth && statusOk;
      } catch {
        return false;
      }
    });
  }, [transactions, monthRef, onlyPaid]);

  // Totais
  const totals = useMemo(() => {
    let entradas = 0, saidas = 0;
    for (const t of filtered) {
      const val = Number(t.value) || 0;
      if ((t.type || "").toLowerCase() === "entrada") entradas += val;
      else saidas += val;
    }
    return { entradas, saidas, saldo: entradas - saidas };
  }, [filtered]);

  // Despesas por categoria (donut) – apenas saídas
  const donut = useMemo(() => {
    const map = new Map(); // categoria -> soma
    for (const t of filtered) {
      if ((t.type || "").toLowerCase() !== "saída" && (t.type || "").toLowerCase() !== "saida") continue;
      const cat = t.category || "Outros";
      map.set(cat, (map.get(cat) || 0) + (Number(t.value) || 0));
    }
    const labels = Array.from(map.keys());
    const values = labels.map((k) => map.get(k));
    return { labels, values };
  }, [filtered]);

  // Evolução últimos 6 meses (saldo mensal)
  const evolution = useMemo(() => {
    const labels = lastMonthsLabels(6);
    const map = new Map(labels.map((l) => [l, 0]));
    for (const t of transactions) {
      const dt = new Date(t.date);
      const key = dt.toLocaleDateString("pt-PT", { month: "2-digit" }) + "/" + String(dt.getFullYear()).slice(-2);
      if (!map.has(key)) continue;
      const val = Number(t.value) || 0;
      const isEntrada = (t.type || "").toLowerCase() === "entrada";
      const signed = isEntrada ? val : -val;
      // Se “apenas pagos” estiver marcado, considera só pagos
      if (onlyPaid && (t.status || "").toLowerCase() !== "pago") continue;
      map.set(key, (map.get(key) || 0) + signed);
    }
    return { labels: Array.from(map.keys()), values: Array.from(map.values()) };
  }, [transactions, onlyPaid]);

  // UI
  return (
    <main className="page">
      <div className="head">
        <h1 className="title">Dashboard</h1>
        <div className="filters">
          <label className="field">
            <span className="fieldLabel">Mês</span>
            <input
              type="month"
              value={monthRef}
              onChange={(e) => setMonthRef(e.target.value)}
              className="monthInput"
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={onlyPaid}
              onChange={(e) => setOnlyPaid(e.target.checked)}
            />
            <span>Considerar apenas pagos</span>
          </label>
        </div>
      </div>

      {/* cards topo: Entradas / Saídas / Saldo */}
      <section className="topCards">
        <div className="kpi">
          <small>Entradas</small>
          <b>{totals.entradas.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</b>
        </div>
        <div className="kpi">
          <small>Saídas</small>
          <b style={{ color: "#ef4444" }}>
            {totals.saidas.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
          </b>
        </div>
        <div className="kpi">
          <small>Saldo</small>
          <b style={{ color: totals.saldo >= 0 ? "#16a34a" : "#ef4444" }}>
            {totals.saldo.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
          </b>
        </div>
      </section>

      {/* linha de gráficos */}
      <section className="charts">
        <div className="card">
          <div className="cardTitle">Despesas por categoria ({monthRef})</div>
          <PieChartComponent labels={donut.labels} values={donut.values} />
        </div>

        <div className="card">
          <div className="cardTitle">Evolução (últimos 6 meses)</div>
          <BarChartComponent labels={evolution.labels} values={evolution.values.map(v => Math.max(0, v))} />
        </div>
      </section>

      <style jsx>{`
        .page { padding: 18px 18px 32px; }
        .head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
        .title { font-size: 28px; line-height: 1.1; margin: 0; display: flex; align-items: center; gap: 8px; }
        .filters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .field { display: grid; gap: 6px; font-size: 13px; color: #6b7280; }
        .fieldLabel { font-size: 12px; }
        .monthInput {
          appearance: none;
          padding: 8px 10px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fff;
        }
        .check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6b7280; }
        .topCards { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; margin: 8px 0 16px; }
        .kpi {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 14px 16px;
          display: grid;
          gap: 6px;
          box-shadow: 0 1px 2px rgba(0,0,0,.03);
        }
        .kpi small { color: #6b7280; }
        .kpi b { font-size: 20px; }
        .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 14px 16px;
          box-shadow: 0 1px 2px rgba(0,0,0,.03);
        }
        .cardTitle { font-weight: 600; margin-bottom: 10px; }

        /* Responsivo */
        @media (max-width: 980px) {
          .charts { grid-template-columns: 1fr; }
        }
        @media (prefers-color-scheme: dark) {
          .monthInput { background: #0f172a; color: #e5e7eb; border-color: #334155; }
          .kpi, .card { background: #0f172a; border-color: #334155; }
          .field, .check { color: #9ca3af; }
          .cardTitle { color: #e5e7eb; }
        }
      `}</style>
    </main>
  );
}
