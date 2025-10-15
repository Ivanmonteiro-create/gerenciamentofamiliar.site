"use client";

import { useEffect, useMemo, useState } from "react";

/** ================== STORAGE KEYS ================== */
const KEY_ASSETS = "gf_invest_assets_v2";

/** ================== HELPERS ================== */
function loadLS(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function saveLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6); }
function fmt(n) { return Number(n || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" }); }
function pct(a, b) {
  const base = Number(b || 0);
  if (!base) return "0.00%";
  return ((Number(a || 0) / base) * 100).toFixed(2) + "%";
}

/** ================== TIPOS DE ATIVO ==================
 * "crypto"  -> preço ao vivo via CoinGecko (EUR)
 * "stock"   -> preço manual (por enquanto)
 * "other"   -> preço manual
 */
const TYPE_LABEL = { crypto: "Cripto", stock: "Ação", other: "Outro" };

/** ================== COMPONENTE ================== */
export default function InvestimentosPage() {
  const [assets, setAssets] = useState([]);
  const [loadingPrices, setLoadingPrices] = useState(false);

  // formulário de novo ativo
  const [form, setForm] = useState({
    type: "crypto",
    symbol: "",
    name: "",
    qty: "",
    avgPrice: "",
    manualPrice: "", // usado para stock/other
    color: "#22c55e",
  });

  // cache de mapeamento CoinGecko (SYM -> id)
  const [cgMap, setCgMap] = useState(() => loadLS("gf_cg_map_v1", {}));

  /** carregar */
  useEffect(() => { setAssets(loadLS(KEY_ASSETS, [])); }, []);
  useEffect(() => { saveLS(KEY_ASSETS, assets); }, [assets]);
  useEffect(() => { saveLS("gf_cg_map_v1", cgMap); }, [cgMap]);

  /** preços ao vivo para CRIPTO */
  const cryptoSymbols = useMemo(
    () => Array.from(new Set(assets.filter(a => a.type === "crypto").map(a => a.symbol.trim().toUpperCase()).filter(Boolean))),
    [assets]
  );

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
          body: JSON.stringify({ type: "crypto", symbols: cryptoSymbols, knownMap }),
        }).then(r => r.json());

        if (!res?.ok) throw new Error(res?.error || "Erro ao buscar preços");

        const newMap = { ...cgMap };
        // guardar ids descobertos
        const resolved = res.resolved || {};
        Object.keys(resolved).forEach(sym => {
          const info = resolved[sym];
          if (info?.id) newMap[sym] = info.id;
        });
        // aplicar preços aos ativos
        const priceBySym = res.data || {};
        if (!cancelled) {
          setCgMap(newMap);
          setAssets(prev =>
            prev.map(a => {
              if (a.type !== "crypto") return a;
              const sym = (a.symbol || "").toUpperCase();
              const live = priceBySym[sym]?.eur;
              return { ...a, livePrice: typeof live === "number" ? live : null };
            })
          );
        }
      } catch {
        // falhou: apenas ignora (fica manual/sem preço)
      } finally {
        if (!cancelled) setLoadingPrices(false);
      }
    }
    updatePrices();
    // atualiza a cada 60s quando estiver na página
    const t = setInterval(updatePrices, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [cryptoSymbols]); // eslint-disable-line

  /** totais */
  const totals = useMemo(() => {
    let cost = 0, now = 0;
    for (const a of assets) {
      const qty = Number(a.qty || 0);
      const avg = Number(a.avgPrice || 0);
      const invested = qty * avg;
      cost += invested;

      let current = 0;
      if (a.type === "crypto") {
        const live = Number(a.livePrice || 0);
        current = qty * (live || 0);
      } else {
        const price = Number(a.manualPrice || 0);
        current = qty * price;
      }
      now += current;
    }
    return { cost, now, pnl: now - cost, pnlPct: pct(now - cost, cost) };
  }, [assets]);

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
      name: form.name.trim(),
      qty,
      avgPrice: avg,
      manualPrice: (form.type === "crypto") ? undefined : manual,
      color: form.color || "#22c55e",
      livePrice: null, // para cripto, será preenchido quando carregar
      createdAt: Date.now(),
    };
    setAssets(a => [newA, ...a]);
    setForm({ type: "crypto", symbol: "", name: "", qty: "", avgPrice: "", manualPrice: "", color: "#22c55e" });
  }

  function removeAsset(id) {
    if (!confirm("Excluir este ativo?")) return;
    setAssets(a => a.filter(x => x.id !== id));
  }

  /** UI util */
  function rowNowValue(a) {
    const qty = Number(a.qty || 0);
    const price = (a.type === "crypto") ? Number(a.livePrice || 0) : Number(a.manualPrice || 0);
    return qty * price;
  }
  function rowCost(a) { return Number(a.qty || 0) * Number(a.avgPrice || 0); }

  /** ================== RENDER ================== */
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Investimentos</h1>

      {/* KPIs topo */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <KPI label="Valor atual" value={fmt(totals.now)} />
        <KPI label="Custo total" value={fmt(totals.cost)} />
        <KPI label="P/L não realizado" value={`${fmt(totals.pnl)} (${totals.pnlPct})`} tone={totals.pnl >= 0 ? "up" : "down"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr .9fr", gap: 14 }}>
        {/* carteira */}
        <div style={cardBox}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <b>Carteira</b>
            {loadingPrices && <span style={{ fontSize: 12, opacity: .7 }}>Atualizando preços...</span>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={{ minWidth: 110 }}>Ativo</th>
                  <th>Tipo</th>
                  <th>Qtd</th>
                  <th>Preço Médio</th>
                  <th>Preço Atual</th>
                  <th>Valor atual</th>
                  <th>P/L</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 14, textAlign: "center", opacity: .6 }}>Nenhum ativo.</td></tr>
                ) : (
                  assets.map(a => {
                    const cost = rowCost(a);
                    const nowVal = rowNowValue(a);
                    const pl = nowVal - cost;
                    const plPct = pct(pl, cost);
                    const priceAtual = (a.type === "crypto")
                      ? (a.livePrice != null ? fmt(a.livePrice) : "—")
                      : fmt(a.manualPrice || 0);

                    return (
                      <tr key={a.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 999, background: a.color }} />
                            <div>
                              <div style={{ fontWeight: 600 }}>{a.symbol}</div>
                              {a.name ? <div style={{ fontSize: 12, opacity: .7 }}>{a.name}</div> : null}
                            </div>
                          </div>
                        </td>
                        <td>{TYPE_LABEL[a.type] || a.type}</td>
                        <td>{Number(a.qty || 0).toLocaleString("pt-PT")}</td>
                        <td>{fmt(a.avgPrice || 0)}</td>
                        <td>{priceAtual}</td>
                        <td>{fmt(nowVal)}</td>
                        <td>
                          <Badge tone={pl >= 0 ? "up" : "down"}>
                            {fmt(pl)} ({plPct})
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

        {/* adicionar ativo */}
        <form onSubmit={addAsset} style={cardBox}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Adicionar ativo</div>
          <div style={{ display: "grid", gap: 8 }}>
            {/* Tipo */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ fontSize: 12, opacity: .8 }}>Tipo</label>
              <div style={{ display: "flex", gap: 10 }}>
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

            {/* Símbolo e Nome (opcional) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                placeholder={form.type === "crypto" ? "Símbolo (ex.: BTC)" : "Símbolo/Ticker"}
                value={form.symbol}
                onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))}
                style={input}
                required
              />
              <input
                placeholder="Nome (opcional)"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                style={input}
              />
            </div>

            {/* Quantidade e Preço Médio */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                placeholder="Quantidade"
                value={form.qty}
                onChange={e => setForm(p => ({ ...p, qty: e.target.value }))}
                style={input}
                inputMode="decimal"
                required
              />
              <input
                placeholder="Preço médio (€)"
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
                placeholder="Preço atual (€) — manual"
                value={form.manualPrice}
                onChange={e => setForm(p => ({ ...p, manualPrice: e.target.value }))}
                style={input}
                inputMode="decimal"
              />
            )}

            {/* Cor */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
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

            {/* observação */}
            <small style={{ color: "#6b7280" }}>
              Criptos: preço via CoinGecko. Ações/Outros: informe preço manual por enquanto.
            </small>
          </div>
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
const btnPrimary = { ...btnBase, background: "#2563eb", color: "#fff", borderColor: "#1d4ed8" };
const btnDanger  = { ...btnBase, background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" };

function KPI({ label, value, tone }) {
  const color = tone === "up" ? "#166534" : tone === "down" ? "#991b1b" : "#111827";
  const bg = tone === "up" ? "#dcfce7" : tone === "down" ? "#fee2e2" : "#f3f4f6";
  return (
    <div style={{ ...cardBox, padding: 12, display: "grid", gap: 4 }}>
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
    <span style={{ padding: "2px 8px", borderRadius: 999, background: bg, color, fontSize: 12 }}>
      {children}
    </span>
  );
}
