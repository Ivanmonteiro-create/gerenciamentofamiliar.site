// app/investimentos/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** =========================
 *  Storage helpers
 * ========================= */
const ASSETS_KEY = "gf_invest_assets_v2"; // [{id,symbol,name,color,qty,avg}]
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
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(6);
}
const fmt = (n) =>
  Number(n || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

/** =========================
 *  Mapa de Símbolo → CoinGecko ID
 *  (se não achar, tenta symbol.toLowerCase())
 * ========================= */
const CG_ID = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
  ADA: "cardano",
  XRP: "ripple",
  DOGE: "dogecoin",
  DOT: "polkadot",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  TRX: "tron",
  LINK: "chainlink",
  LTC: "litecoin",
  WLD: "worldcoin-wld",
  PEPE: "pepe",
  SHIB: "shiba-inu",
};

function resolveCgId(symbol) {
  if (!symbol) return "";
  const s = symbol.trim().toUpperCase();
  return CG_ID[s] || s.toLowerCase();
}

/** =========================
 *  Preços (CoinGecko)
 *  - Atualiza a cada 60s
 *  - Pausa quando a aba está oculta
 * ========================= */
async function fetchPricesEUR(ids /* string[] */) {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (uniq.length === 0) return {};
  const url =
    "https://api.coingecko.com/api/v3/simple/price?vs_currencies=eur&ids=" +
    encodeURIComponent(uniq.join(","));
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha na CoinGecko");
  const data = await res.json();
  // Normaliza: { id: { eur: number } }
  const out = {};
  uniq.forEach((id) => {
    const row = data[id];
    out[id] = row && typeof row.eur === "number" ? row.eur : 0;
  });
  return out;
}

/** =========================
 *  Página
 * ========================= */
export default function InvestimentosPage() {
  const [assets, setAssets] = useState([]);
  // cache de preços em EUR por id CoinGecko
  const [prices, setPrices] = useState({});
  const timerRef = useRef(null);

  // formulário
  const [form, setForm] = useState({
    symbol: "",
    name: "",
    qty: "",
    avg: "",
    color: "#16a34a",
  });

  // carregar assets
  useEffect(() => {
    setAssets(loadLS(ASSETS_KEY, []));
  }, []);

  // atualizar preços periodicamente
  useEffect(() => {
    function wantIds() {
      return assets.map((a) => resolveCgId(a.symbol)).filter(Boolean);
    }
    let stopped = false;

    async function update() {
      try {
        const ids = wantIds();
        if (ids.length === 0) return;
        const p = await fetchPricesEUR(ids);
        if (!stopped) setPrices((old) => ({ ...old, ...p }));
      } catch {
        // silencia erros transitórios
      }
    }

    function start() {
      update(); // dispara já
      timerRef.current = setInterval(update, 60_000); // 60s
    }
    function stop() {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // pausa quando a aba fica oculta
    function onVis() {
      if (document.hidden) stop();
      else start();
    }

    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [assets]);

  /** ========= Cálculos por ativo ========= */
  const rows = useMemo(() => {
    return assets.map((a) => {
      const id = resolveCgId(a.symbol);
      const live = prices[id] || 0; // preço ao vivo (EUR) – 0 se indisponível
      const qty = Number(a.qty || 0);
      const avg = Number(a.avg || 0);
      const currentValue = qty * live;
      const cost = qty * avg;
      const pl = currentValue - cost; // P/L não realizado
      const plPct = cost > 0 ? (pl / cost) * 100 : 0;
      return {
        ...a,
        cgId: id,
        live,
        qty,
        avg,
        currentValue,
        cost,
        pl,
        plPct,
      };
    });
  }, [assets, prices]);

  /** ========= Totais ========= */
  const totals = useMemo(() => {
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    const val = rows.reduce((s, r) => s + r.currentValue, 0);
    const pl = val - cost;
    const plPct = cost > 0 ? (pl / cost) * 100 : 0;
    return { cost, val, pl, plPct };
  }, [rows]);

  /** ========= Ações ========= */
  function addAsset(e) {
    e.preventDefault();
    const sym = form.symbol.trim().toUpperCase();
    if (!sym) {
      alert("Informe o símbolo (ex.: BTC, ETH, DOGE).");
      return;
    }
    const next = [
      ...assets,
      {
        id: uid(),
        symbol: sym,
        name: form.name.trim(),
        color: form.color || "#16a34a",
        qty: Number(form.qty || 0),
        avg: Number(form.avg || 0),
      },
    ];
    setAssets(next);
    saveLS(ASSETS_KEY, next);
    setForm({ symbol: "", name: "", qty: "", avg: "", color: "#16a34a" });
  }

  function removeAsset(id) {
    if (!confirm("Excluir este ativo da carteira?")) return;
    const next = assets.filter((a) => a.id !== id);
    setAssets(next);
    saveLS(ASSETS_KEY, next);
  }

  /** ========= UI ========= */
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Investimentos</h1>

      {/* Cards de totais */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        <KPI title="Valor total" value={fmt(totals.val)} />
        <KPI title="Custo total" value={fmt(totals.cost)} />
        <KPI
          title="P/L não realizado"
          value={`${fmt(totals.pl)} (${totals.plPct.toFixed(2)}%)`}
          intent={totals.pl >= 0 ? "up" : "down"}
        />
      </div>

      {/* Tabela */}
      <div className="card" style={cardBox}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <strong>Carteira</strong>
          <small style={{ opacity: 0.7 }}>
            Cotações via CoinGecko (auto a cada 60s). Se um ativo ficar com preço 0, verifique o símbolo.
          </small>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th>Ativo</th>
                <th>Qtd</th>
                <th>Preço médio</th>
                <th>Preço atual</th>
                <th>Valor atual</th>
                <th>P/L</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 16, opacity: 0.6 }}>
                    Adicione um ativo abaixo.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          title={r.symbol}
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: r.color || "#16a34a",
                            boxShadow: "0 0 0 1px rgba(0,0,0,.08)",
                          }}
                        />
                        <div style={{ display: "grid", lineHeight: 1.2 }}>
                          <b>{r.symbol}</b>
                          <small style={{ opacity: 0.7 }}>{r.name || r.cgId}</small>
                        </div>
                      </div>
                    </td>
                    <td>{r.qty}</td>
                    <td>{fmt(r.avg)}</td>
                    <td>{r.live ? fmt(r.live) : "—"}</td>
                    <td>{fmt(r.currentValue)}</td>
                    <td>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: r.pl >= 0 ? "#dcfce7" : "#fee2e2",
                          color: r.pl >= 0 ? "#166534" : "#991b1b",
                          whiteSpace: "nowrap",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fmt(r.pl)} ({r.plPct.toFixed(2)}%)
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button style={btnDanger} onClick={() => removeAsset(r.id)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form de novo ativo */}
      <form onSubmit={addAsset} className="card" style={{ ...cardBox, marginTop: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Adicionar ativo</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          <div style={{ gridColumn: "span 1" }}>
            <label style={lb}>Símbolo</label>
            <input
              style={input}
              placeholder="ex.: BTC"
              value={form.symbol}
              onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))}
              required
            />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label style={lb}>Nome (opcional)</label>
            <input
              style={input}
              placeholder="ex.: Bitcoin"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div style={{ gridColumn: "span 1" }}>
            <label style={lb}>Quantidade</label>
            <input
              style={input}
              inputMode="decimal"
              value={form.qty}
              onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))}
              required
            />
          </div>
          <div style={{ gridColumn: "span 1" }}>
            <label style={lb}>Preço médio (€)</label>
            <input
              style={input}
              inputMode="decimal"
              value={form.avg}
              onChange={(e) => setForm((p) => ({ ...p, avg: e.target.value }))}
              required
            />
          </div>
          <div style={{ gridColumn: "span 1" }}>
            <label style={lb}>Cor</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                style={{ width: 46, height: 36, border: "1px solid #e5e7eb", borderRadius: 8 }}
              />
              <button type="submit" style={btnPrimary}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

/** =========================
 *  UI tokens
 * ========================= */
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
const lb = { fontSize: 12, opacity: 0.7, display: "block", marginBottom: 4 };
const input = {
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

function KPI({ title, value, intent }) {
  const bg = intent === "up" ? "#dcfce7" : intent === "down" ? "#fee2e2" : "#f3f4f6";
  const fg = intent === "up" ? "#166534" : intent === "down" ? "#991b1b" : "#111827";
  return (
    <div
      className="card"
      style={{
        ...cardBox,
        background: "var(--card-bg, #fff)",
        display: "grid",
        gap: 4,
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 12, opacity: 0.7 }}>{title}</span>
      <span
        style={{
          padding: "6px 10px",
          borderRadius: 10,
          background: bg,
          color: fg,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* Estilos de tabela (opcional, mantém seu visual atual) */
const style = `
table th, table td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }
table th { font-weight: 600; font-size: 12px; color: #6b7280; }
`;
if (typeof document !== "undefined" && !document.getElementById("inv-inline-style")) {
  const el = document.createElement("style");
  el.id = "inv-inline-style";
  el.textContent = style;
  document.head.appendChild(el);
}
