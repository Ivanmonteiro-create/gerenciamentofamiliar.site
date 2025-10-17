"use client";

import { useEffect, useMemo, useState } from "react";

/** ================== STORAGE KEYS ================== */
const KEY_ASSETS = "gf_invest_assets_v3";
const KEY_CG_MAP = "gf_cg_map_v1";

/** ================== HELPERS ================== */
function loadLS(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function saveLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6); }
function fmt(n, cur) { return Number(n || 0).toLocaleString("pt-PT", { style: "currency", currency: cur }); }
function pct(a, b) {
  const base = Number(b || 0);
  if (!base) return "0.00%";
  return ((Number(a || 0) / base) * 100).toFixed(2) + "%";
}

const TYPE_LABEL = { crypto: "Cripto", stock: "Ação", other: "Outro" };

/** ================== COMPONENTE ================== */
export default function InvestimentosPage() {
  const [assets, setAssets] = useState([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [currency, setCurrency] = useState(() => loadLS("gf_fx_pref", "EUR")); // "EUR" | "USD" | "BRL"
  const [lastUpdated, setLastUpdated] = useState(null);

  // formulário de novo ativo
  const [form, setForm] = useState({
    type: "crypto",
    symbol: "",
    qty: "",
    avgPrice: "",
    manualPrice: "", // usado para stock/other
    color: "#22c55e",
  });

  // cache de mapeamento CoinGecko (SYM -> id)
  const [cgMap, setCgMap] = useState(() => loadLS(KEY_CG_MAP, {}));

  /** carregar / salvar */
  useEffect(() => { setAssets(loadLS(KEY_ASSETS, [])); }, []);
  useEffect(() => { saveLS(KEY_ASSETS, assets); }, [assets]);
  useEffect(() => { saveLS(KEY_CG_MAP, cgMap); }, [cgMap]);
  useEffect(() => { saveLS("gf_fx_pref", currency); }, [currency]);

  /** símbolos de cripto presentes */
  const cryptoSymbols = useMemo(
    () => Array.from(new Set(assets.filter(a => a.type === "crypto").map(a => a.symbol.trim().toUpperCase()).filter(Boolean))),
    [assets]
  );

  /** buscar preços (EUR/USD/BRL) e armazenar nos ativos */
  useEffect(() => {
    let cancelled = false;
    async function updatePrices() {
      if (cryptoSymbols.length === 0) return;
      setLoadingPrices(true);
      try {
        const knownMap = {};
        for (const s of cryptoSymbols) if (cgMap[s]) knownMap[s] = cgMap[s];

        const res = await fetch("/api/prices", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "crypto", symbols: cryptoSymbols, knownMap, currency }),
        }).then(r => r.json());

        if (!res?.ok) throw new Error(res?.error || "Erro ao buscar preços");

        const newMap = { ...cgMap };
        const resolved = res.resolved || {};
        Object.keys(resolved).forEach(sym => {
          const info = resolved[sym];
          if (info?.id) newMap[sym] = info.id;
        });

        const priceBySym = res.data || {}; // {SYM: {eur,usd,brl}}
        if (!cancelled) {
          setCgMap(newMap);
          setAssets(prev =>
            prev.map(a => {
              if (a.type !== "crypto") return a;
              const sym = (a.symbol || "").toUpperCase();
              const prices = priceBySym[sym] || null;
              return { ...a, livePrices: prices }; // guarda os 3
            })
          );
          setLastUpdated(Date.now());
        }
      } catch {
        // ignora falha
      } finally {
        if (!cancelled) setLoadingPrices(false);
      }
    }
    updatePrices();
    const t = setInterval(updatePrices, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [cryptoSymbols, currency]); // refaz ao trocar moeda (garante coerência)

  /** helpers de preço atual por ativo + moeda preferida */
  function currentUnitPrice(a) {
    if (a.type === "crypto") {
      const p = a.livePrices || {};
      if (currency === "USD") return Number(p.usd || 0);
      if (currency === "BRL") return Number(p.brl || 0);
      return Number(p.eur || 0);
    }
    // Para Ação/Outro, preço manual já deve estar na moeda escolhida
    return Number(a.manualPrice || 0);
  }
  function rowNowValue(a) { return Number(a.qty || 0) * currentUnitPrice(a); }
  function rowCost(a) { return Number(a.qty || 0) * Number(a.avgPrice || 0); }

  /** totais */
  const totals = useMemo(() => {
    let cost = 0, now = 0;
    for (const a of assets) {
      cost += rowCost(a);
      now += rowNowValue(a);
    }
    return { cost, now, pnl: now - cost, pnlPct: pct(now - cost, cost) };
  }, [assets, currency]);

  /** ações */
  function addAsset(e) {
    e.preventDefault();
    const symbol = form.symbol.trim().toUpperCase();
    if (!symbol) { alert("Informe o símbolo."); return; }
    const qty = Number(form.qty || 0);
    const avg = Number(form.avgPrice || 0);
    const manual = Number(form.manualPrice || 0);

    const newA = {
      id: uid(),
      type: form.type,
      symbol,
      qty,
      avgPrice: avg,
      manualPrice: form.type === "crypto" ? undefined : manual,
      color: form.color || "#22c55e",
      livePrices: null, // {eur,usd,brl} preenchido pela API
      createdAt: Date.now(),
    };
    setAssets(a => [newA, ...a]);
    setForm({ type: "crypto", symbol: "", qty: "", avgPrice: "", manualPrice: "", color: "#22c55e" });
  }

  function removeAsset(id) {
    if (!confirm("Excluir este ativo?")) return;
    setAssets(a => a.filter(x => x.id !== id));
  }

  /** ================== RENDER ================== */
  const currencyLabel = currency;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 14 }}>Investimentos</h1>

      {/* KPIs topo + seletor de moeda */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, marginBottom: 16 }}>
        <KPI label="Valor atual" value={fmt(totals.now, currency)} />
        <KPI label="Custo total" value={fmt(totals.cost, currency)} />
        <KPI label="P/L não realizado" value={`${fmt(totals.pnl, currency)} (${totals.pnlPct})`} tone={totals.pnl >= 0 ? "up" : "down"} />
        <div style={{ ...cardBox, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Moeda</span>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            style={input}
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="BRL">BRL</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.8fr", gap: 16, alignItems: "start" }}>
        {/* carteira */}
        <div style={{ ...cardBox, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <b>Carteira</b>
            {loadingPrices && <span style={{ fontSize: 12, opacity: .7 }}>Atualizando preços…</span>}
            {lastUpdated && (
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                • atualizado {Math.floor((Date.now() - lastUpdated)/1000)}s atrás
              </span>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={{ minWidth: 140, textAlign: "left" }}>Ativo</th>
                  <th style={{ minWidth: 90 }}>Tipo</th>
                  <th style={{ minWidth: 100 }}>Qtd</th>
                  <th style={{ minWidth: 140 }}>Preço médio ({currencyLabel})</th>
                  <th style={{ minWidth: 160 }}>Preço atual ({currencyLabel})</th>
                  <th style={{ minWidth: 160 }}>Valor atual ({currencyLabel})</th>
                  <th style={{ minWidth: 160 }}>P/L</th>
                  <th style={{ minWidth: 120 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 16, textAlign: "center", opacity: .6 }}>
                      Nenhum ativo.
                    </td>
                  </tr>
                ) : (
                  assets.map(a => {
                    const cost = rowCost(a);
                    const nowVal = rowNowValue(a);
                    const pl = nowVal - cost;
                    const plPct = pct(pl, cost);
                    const unit = currentUnitPrice(a);

                    return (
                      <tr key={a.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ width: 12, height: 12, borderRadius: 999, background: a.color }} />
                            <div style={{ lineHeight: 1.2 }}>
                              <div style={{ fontWeight: 600 }}>{a.symbol}</div>
                            </div>
                          </div>
                        </td>
                        <td>{TYPE_LABEL[a.type] || a.type}</td>
                        <td>{Number(a.qty || 0).toLocaleString("pt-PT")}</td>
                        <td>{fmt(a.avgPrice || 0, currency)}</td>
                        <td>{unit ? fmt(unit, currency) : "—"}</td>
                        <td>{fmt(nowVal, currency)}</td>
                        <td>
                          <Badge tone={pl >= 0 ? "up" : "down"}>
                            {fmt(pl, currency)} ({plPct})
                          </Badge>
                        </td>
                        <td>
                          <button style={btnDanger} onClick={() => removeAsset(a.id)}>Excluir</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* adicionar ativo (à direita), mais compacto */}
        <form onSubmit={addAsset} style={{ ...cardBox, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Adicionar ativo</div>

          {/* Tipo */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, opacity: .8 }}>Tipo</span>
            <div style={{ display: "flex", gap: 12 }}>
              {["crypto", "stock", "other"].map(t => (
                <label key={t} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                  <input
                    type="radio"
                    name="type"
                    checked={form.type === t}
                    onChange={() => setForm(p => ({ ...p, type: t }))}
                  />
                  {TYPE_LABEL[t]}
                </label>
              ))}
            </div>
          </div>

          {/* Símbolo + Buscar (buscar deslocado para a direita) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 6 }}>
            <input
              placeholder={form.type === "crypto" ? "Símbolo (ex.: BTC)" : "Símbolo/Ticker"}
              value={form.symbol}
              onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))}
              style={input}
              required
            />
            <button
              type="button"
              onClick={() => alert("Digite o símbolo. Para cripto, o mapeamento é automático na hora de salvar.")}
              style={btnSoft}
              title="Buscar opções por símbolo"
            >
              Buscar
            </button>
          </div>

          {/* Quantidade e Preço Médio */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
            <input
              placeholder="Quantidade"
              value={form.qty}
              onChange={e => setForm(p => ({ ...p, qty: e.target.value }))}
              style={input}
              inputMode="decimal"
              required
            />
            <input
              placeholder={`Preço médio (${currencyLabel})`}
              value={form.avgPrice}
              onChange={e => setForm(p => ({ ...p, avgPrice: e.target.value }))}
              style={input}
              inputMode="decimal"
              required
            />
          </div>

          {/* Preço manual (apenas para ações/outros) */}
          {form.type !== "crypto" && (
            <input
              placeholder={`Preço atual (${currencyLabel}) — manual`}
              value={form.manualPrice}
              onChange={e => setForm(p => ({ ...p, manualPrice: e.target.value }))}
              style={{ ...input, marginBottom: 6 }}
              inputMode="decimal"
            />
          )}

          {/* Cor */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, opacity: .8 }}>Cor</span>
            <input
              type="color"
              value={form.color}
              onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
              style={{ width: 48, height: 28, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>

          <div style={{ textAlign: "right" }}>
            <button type="submit" style={btnPrimary}>Salvar</button>
          </div>

          <small style={{ color: "#6b7280", display: "block", marginTop: 8 }}>
            Criptos: preço via CoinGecko. Ações/Outros: informe preço manual (na moeda selecionada).
          </small>
        </form>
      </div>
    </div>
  );
}

/** ================== UI TOKENS ================== */
const cardBox = {
  background: "var(--card-bg, #fff)",
  border: "1px solid var(--card-bd, #e5e7eb)",
  borderRadius: 14,
  padding: 14,
  boxShadow: "0 1px 2px rgba(0,0,0,.04)",
};

const table = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: "0 8px",
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
  height: 36,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid transparent",
  cursor: "pointer",
};
const btnPrimary = { ...btnBase, background: "#2563eb", color: "#fff", borderColor: "#1d4ed8" };
const btnSoft    = { ...btnBase, background: "#f3f4f6", color: "#111827", borderColor: "#e5e7eb" };
const btnDanger  = { ...btnBase, background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" };

function KPI({ label, value, tone }) {
  const color = tone === "up" ? "#166534" : tone === "down" ? "#991b1b" : "#111827";
  const bg = tone === "up" ? "#dcfce7" : tone === "down" ? "#fee2e2" : "#f3f4f6";
  return (
    <div style={{ ...cardBox, padding: 12, display: "grid", gap: 4, minWidth: 180 }}>
      <span style={{ fontSize: 12, color: "#6b7280" }}>{label}</span>
      <b style={{ fontSize: 18, color }}>{value}</b>
      {tone && <div style={{ background: bg, borderRadius: 10, height: 6 }} />}
    </div>
  );
}

function Badge({ tone = "neutral", children }) {
  const bg = tone === "up" ? "#dcfce7" : tone === "down" ? "#fee2e2" : "#e5e7eb";
  const color = tone === "up" ? "#166534" : tone === "down" ? "#991b1b" : "#111827";
  return (
    <span style={{ padding: "2px 8px", borderRadius: 999, background: bg, color, fontSize: 12, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}
