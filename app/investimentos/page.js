"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** ====== STORAGE KEYS ====== */
const PF_KEY = "gf_portfolio_v1";
const ALERTS_KEY = "gf_alerts_v1";

/** ====== HELPERS ====== */
function loadLS(key, fallback) {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveLS(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(6);
}
function fmt(n) {
  const v = Number(n || 0);
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}
function pct(n) {
  const v = Number(n || 0);
  if (!isFinite(v)) return "0%";
  return `${(v * 100).toFixed(2)}%`;
}

/** ====== SPARKLINE INLINE (SVG) ====== */
function Sparkline({ points = [], width = 120, height = 36 }) {
  if (!points?.length) return <svg width={width} height={height} />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pad = 2;
  const W = width - pad * 2;
  const H = height - pad * 2;
  const norm = (v) => (max === min ? 0.5 : (v - min) / (max - min));
  const d = points
    .map((v, i) => {
      const x = pad + (i / (points.length - 1)) * W;
      const y = pad + (1 - norm(v)) * H;
      return `${i ? "L" : "M"}${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** ====== PAGE ====== */
export default function InvestimentosPage() {
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [quotes, setQuotes] = useState({}); // { BTC: {price, change24h, currency, spark:[]}, ... }
  const [loading, setLoading] = useState(false);

  // form
  const [form, setForm] = useState({
    type: "crypto", // crypto | stock | other
    symbol: "",
    name: "",
    quantity: "",
    avgPrice: "",
    color: "#22c55e",
  });

  /** load */
  useEffect(() => {
    setItems(loadLS(PF_KEY, []));
    setAlerts(loadLS(ALERTS_KEY, []));
  }, []);

  /** polling de cotações (apenas crypto/stock) */
  const pollRef = useRef(null);
  useEffect(() => {
    const symbols = items
      .filter((it) => it.type === "crypto" || it.type === "stock")
      .map((it) => it.symbol?.trim().toUpperCase())
      .filter(Boolean);

    if (!symbols.length) {
      setQuotes({});
      return;
    }

    let stopped = false;

    async function fetchQuotes() {
      try {
        setLoading(true);
        const url = `/api/quotes?assets=${encodeURIComponent(symbols.join(","))}&currency=EUR`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("quotes fetch failed");
        const data = await res.json();
        if (!stopped) setQuotes(data?.quotes || {});
      } catch {
        // mantém última boa
      } finally {
        setLoading(false);
      }
    }

    // primeira chamada
    fetchQuotes();

    // ajusta período: cripto 25s / ações 90s; misto = 45s
    const hasCrypto = items.some((it) => it.type === "crypto");
    const hasStocks = items.some((it) => it.type === "stock");
    const intervalMs = hasCrypto && hasStocks ? 45000 : hasCrypto ? 25000 : 90000;

    function start() {
      clearInterval(pollRef.current);
      pollRef.current = setInterval(fetchQuotes, intervalMs);
    }
    start();

    // pausa quando a aba perde foco
    function onVis() {
      if (document.hidden) {
        clearInterval(pollRef.current);
      } else {
        fetchQuotes();
        start();
      }
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stopped = true;
      clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [items]);

  /** cálculos */
  const enriched = useMemo(() => {
    return items.map((it) => {
      const q = quotes[it.symbol?.toUpperCase()];
      const livePrice = it.type === "other" ? null : q?.price ?? null;
      const current = livePrice != null ? Number(it.quantity) * livePrice : Number(it.quantity) * Number(it.avgPrice || 0);
      const cost = Number(it.quantity) * Number(it.avgPrice || 0);
      const pl = current - cost;
      const plPct = cost > 0 ? pl / cost : 0;
      const dayChangePct = q?.change24h ? q.change24h / 100 : 0;
      const dayPl = livePrice != null ? Number(it.quantity) * livePrice * dayChangePct : 0;
      return {
        ...it,
        livePrice,
        current,
        cost,
        pl,
        plPct,
        dayPl,
        currency: q?.currency || "EUR",
        spark: q?.spark || [],
      };
    });
  }, [items, quotes]);

  const totals = useMemo(() => {
    const current = enriched.reduce((s, r) => s + r.current, 0);
    const cost = enriched.reduce((s, r) => s + r.cost, 0);
    const pl = current - cost;
    const dayPl = enriched.reduce((s, r) => s + r.dayPl, 0);
    return { current, cost, pl, plPct: cost > 0 ? pl / cost : 0, dayPl };
  }, [enriched]);

  /** alerts locais */
  useEffect(() => {
    if (!alerts?.length) return;
    enriched.forEach((it) => {
      const a = alerts.find((al) => al.symbol?.toUpperCase() === it.symbol?.toUpperCase() && al.enabled);
      if (!a || it.livePrice == null) return;
      const hit = a.dir === "below" ? it.livePrice <= Number(a.price) : it.livePrice >= Number(a.price);
      if (hit) {
        alert(`Alerta: ${it.symbol} ${a.dir === "below" ? "≤" : "≥"} ${fmt(a.price)} (preço atual ${fmt(it.livePrice)})`);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched.map((e) => e.livePrice).join("|")]);

  /** ações CRUD */
  function addItem(e) {
    e.preventDefault();
    const row = {
      id: uid(),
      type: form.type,
      symbol: (form.symbol || "").trim().toUpperCase(),
      name: form.name?.trim() || form.symbol?.trim().toUpperCase(),
      quantity: Number(form.quantity || 0),
      avgPrice: Number(form.avgPrice || 0),
      color: form.color || "#22c55e",
      createdAt: Date.now(),
    };
    const next = [...items, row];
    setItems(next);
    saveLS(PF_KEY, next);
    setForm({ type: "crypto", symbol: "", name: "", quantity: "", avgPrice: "", color: "#22c55e" });
  }
  function removeItem(id) {
    if (!confirm("Excluir este ativo?")) return;
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    saveLS(PF_KEY, next);
  }

  /** UI */
  return (
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Investimentos</h1>

      {/* KPIs topo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPI label="Valor atual" value={fmt(totals.current)} />
        <KPI label="Custo total" value={fmt(totals.cost)} />
        <KPI label="P/L não realizado" value={`${fmt(totals.pl)} (${pct(totals.plPct)})`} tone={totals.pl >= 0 ? "green" : "red"} />
        <KPI label="P/L do dia" value={fmt(totals.dayPl)} tone={totals.dayPl >= 0 ? "green" : "red"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr .8fr", gap: 16 }}>
        {/* TABELA */}
        <div style={cardBox}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <b>Carteira</b>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{loading ? "Atualizando..." : "Ao vivo ✓"}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th>Ativo</th>
                  <th>Qtd</th>
                  <th>Preço médio</th>
                  <th>Preço ao vivo</th>
                  <th>Valor atual</th>
                  <th>P/L</th>
                  <th>Dia</th>
                  <th>Gráfico</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {enriched.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: 16, opacity: 0.6 }}>
                      Nenhum ativo cadastrado.
                    </td>
                  </tr>
                ) : (
                  enriched.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: it.color }} />
                          <div style={{ display: "grid", lineHeight: 1.1 }}>
                            <b>{it.symbol}</b>
                            <small style={{ opacity: 0.7 }}>{it.name}</small>
                          </div>
                        </div>
                      </td>
                      <td>{Number(it.quantity)}</td>
                      <td>{fmt(it.avgPrice)}</td>
                      <td>{it.livePrice != null ? fmt(it.livePrice) : "—"}</td>
                      <td>{fmt(it.current)}</td>
                      <td style={{ color: it.pl >= 0 ? "#166534" : "#991b1b" }}>
                        {fmt(it.pl)} ({pct(it.plPct)})
                      </td>
                      <td style={{ color: it.dayPl >= 0 ? "#166534" : "#991b1b" }}>
                        {fmt(it.dayPl)}
                      </td>
                      <td>
                        <Sparkline points={it.spark || []} />
                      </td>
                      <td>
                        <button style={btnDanger} onClick={() => removeItem(it.id)}>Excluir</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={addItem} style={cardBox}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Adicionar ativo</div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                style={input}
              >
                <option value="crypto">Cripto</option>
                <option value="stock">Ação</option>
                <option value="other">Outro (sem cotação)</option>
              </select>
              <input
                placeholder="Símbolo (ex.: BTC, ETH, AAPL)"
                value={form.symbol}
                onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))}
                style={input}
                required={form.type !== "other"}
              />
            </div>
            <input
              placeholder="Nome (opcional)"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              style={input}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                placeholder="Quantidade"
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                inputMode="decimal"
                style={input}
                required
              />
              <input
                placeholder="Preço médio (EUR)"
                value={form.avgPrice}
                onChange={(e) => setForm((p) => ({ ...p, avgPrice: e.target.value }))}
                inputMode="decimal"
                style={input}
                required
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>Cor</span>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
              />
            </div>
            <div>
              <button type="submit" style={btnPrimary}>Salvar</button>
            </div>
          </div>
        </form>
      </div>

      <small style={{ opacity: 0.6 }}>
        Cotações: cripto via CoinGecko; ações via Alpha Vantage (se configurado). Atualização automática com pausa quando a aba está em segundo plano.
      </small>
    </div>
  );
}

/** ====== UI tokens ====== */
function KPI({ label, value, tone }) {
  const bg = tone === "green" ? "#dcfce7" : tone === "red" ? "#fee2e2" : "#f3f4f6";
  const fc = tone === "green" ? "#166534" : tone === "red" ? "#991b1b" : "#111827";
  return (
    <div style={{ ...cardBox, background: bg, color: fc }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const cardBox = {
  background: "var(--card-bg, #fff)",
  border: "1px solid var(--card-bd, #e5e7eb)",
  borderRadius: 14,
  padding: 14,
  boxShadow: "0 1px 2px rgba(0,0,0,.04)",
};
const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};
const input = {
  display: "inline-block",
  width: "100%",
  height: 36,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "var(--input-bg, #fff)",
  outline: "none",
};
const btnBase = {
  height: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid transparent",
  cursor: "pointer",
};
const btnPrimary = {
  ...btnBase,
  background: "#2563eb",
  color: "#fff",
  borderColor: "#1d4ed8",
};
const btnDanger = {
  ...btnBase,
  background: "#fee2e2",
  color: "#991b1b",
  borderColor: "#fecaca",
};
