"use client";

import React, { useMemo, useState } from "react";
import PieChartComponent from "../components/PieChartComponent";
import BarChartComponent from "../components/BarChartComponent";

/* ===================== helpers ===================== */

const STORAGE_KEYS = ["gf_transactions_v1", "transactions_v1"];

function tryParseNumber(v) {
  if (v == null) return 0;
  if (typeof v === "number" && isFinite(v)) return v;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function stripAccentsLower(s = "") {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseDateFlex(d) {
  if (!d) return null;
  if (d instanceof Date && !isNaN(d)) return d;
  const s = String(d).trim();

  // ISO: 2025-10-14
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
  const m1 = s.match(iso);
  if (m1) return new Date(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3]));

  // BR/EU: 14/10/2025
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const m2 = s.match(br);
  if (m2) return new Date(Number(m2[3]), Number(m2[2]) - 1, Number(m2[1]));

  // fallback
  const dt = new Date(s);
  return isNaN(dt) ? null : dt;
}

function sameMonth(a, ym) {
  const d = parseDateFlex(a);
  if (!d) return false;
  const [Y, M] = ym.split("-").map(Number); // "YYYY-MM"
  return d.getFullYear() === Y && d.getMonth() + 1 === M;
}

function lastMonthsLabels(count = 6, locale = "pt-PT") {
  const out = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push(
      dt.toLocaleDateString(locale, { month: "2-digit" }) +
        "/" +
        String(dt.getFullYear()).slice(-2)
    );
  }
  return out;
}

function loadTransactions() {
  if (typeof window === "undefined") return [];
  for (const key of STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;

      // normalizar cada item (aceita chaves PT/EN)
      return arr.map((t) => {
        const date = t.data ?? t.date ?? t.dt ?? null;
        const type = t.tipo ?? t.type ?? "";
        const category = t.categoria ?? t.category ?? t.cat ?? "Outros";
        const status = t.status ?? t.situacao ?? t.sit ?? "";
        const value = t.valor ?? t.value ?? 0;

        return {
          date,
          type,
          category,
          status,
          value: tryParseNumber(value),
        };
      });
    } catch {
      // tenta próxima chave
    }
  }
  return [];
}

/* ===================== página ===================== */

export default function DashboardPage() {
  const [onlyPaid, setOnlyPaid] = useState(false); // por padrão mostra tudo
  const [monthRef, setMonthRef] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
  });

  const transactions = useMemo(() => loadTransactions(), []);

  // aplica filtros
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const okMonth = sameMonth(t.date, monthRef);
      if (!okMonth) return false;
      if (!onlyPaid) return true;
      return stripAccentsLower(t.status) === "pago";
    });
  }, [transactions, monthRef, onlyPaid]);

  // totais
  const totals = useMemo(() => {
    let entradas = 0,
      saidas = 0;
    for (const t of filtered) {
      const tp = stripAccentsLower(t.type);
      if (tp === "entrada") entradas += t.value;
      else if (tp === "saida" || tp === "saída") saidas += t.value;
    }
    return { entradas, saidas, saldo: entradas - saidas };
  }, [filtered]);

  // donut: somente saídas por categoria
  const donut = useMemo(() => {
    const map = new Map();
    for (const t of filtered) {
      const tp = stripAccentsLower(t.type);
      if (tp !== "saida" && tp !== "saída") continue;
      const cat = t.category || "Outros";
      map.set(cat, (map.get(cat) || 0) + t.value);
    }
    const labels = Array.from(map.keys());
    const values = labels.map((k) => map.get(k));
    return { labels, values };
  }, [filtered]);

  // evolução 6 meses (saldo) — respeita checkbox “apenas pagos”
  const evolution = useMemo(() => {
    const labels = lastMonthsLabels(6);
    const acc = new Map(labels.map((l) => [l, 0]));
    for (const t of transactions) {
      if (onlyPaid && stripAccentsLower(t.status) !== "pago") continue;
      const d = parseDateFlex(t.date);
      if (!d) continue;
      const key =
        d.toLocaleDateString("pt-PT", { month: "2-digit" }) +
        "/" +
        String(d.getFullYear()).slice(-2);
      if (!acc.has(key)) continue;

      const tp = stripAccentsLower(t.type);
      const signed =
        tp === "entrada" ? +t.value : tp === "saida" || tp === "saída" ? -t.value : 0;
      acc.set(key, (acc.get(key) || 0) + signed);
    }
    return { labels: Array.from(acc.keys()), values: Array.from(acc.values()) };
  }, [transactions, onlyPaid]);

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

      <section className="charts">
        <div className="card">
          <div className="cardTitle">Despesas por categoria ({monthRef})</div>
          <PieChartComponent labels={donut.labels} values={donut.values} />
        </div>

        <div className="card">
          <div className="cardTitle">Evolução (últimos 6 meses)</div>
          <BarChartComponent
            labels={evolution.labels}
            values={evolution.values.map((v) => Math.max(0, v))}
          />
        </div>
      </section>

      <style jsx>{`
        .page { padding: 18px 18px 32px; }
        .head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
        .title { font-size: 28px; line-height: 1.1; margin: 0; }
        .filters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .field { display: grid; gap: 6px; font-size: 13px; color: #6b7280; }
        .fieldLabel { font-size: 12px; }
        .monthInput { appearance: none; padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
        .check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6b7280; }
        .topCards { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; margin: 8px 0 16px; }
        .kpi { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; display: grid; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,.03); }
        .kpi small { color: #6b7280; }
        .kpi b { font-size: 20px; }
        .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 2px rgba(0,0,0,.03); }
        .cardTitle { font-weight: 600; margin-bottom: 10px; }

        @media (max-width: 980px) { .charts { grid-template-columns: 1fr; } }
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
