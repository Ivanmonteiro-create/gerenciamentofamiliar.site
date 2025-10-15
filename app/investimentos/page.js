"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** ======= LS KEYS ======= */
const LS_ASSETS = "gf_invest_assets_v1";

/** ======= UTILS ======= */
const fmt = (n) =>
  Number(n || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function uid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-6);
}

function lsGet(key, fallback) {
  try {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** ======= COINGECKO HELPERS (sem API key) =======
 * Estratégia:
 *  1) /search?query=SYMBOL  -> pega o primeiro match “coins[]”
 *  2) fallback: /coins/list  -> procura symbol exato (case-insensitive)
 *  3) com o id => /simple/price?ids=ID&vs_currencies=eur
 */
async function resolveIdFromSymbol(symbol) {
  const sym = String(symbol || "").trim().toLowerCase();
  if (!sym) return null;

  // 1) tenta /search
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`,
      { cache: "no-store" }
    );
    if (r.ok) {
      const j = await r.json();
      const hit = (j?.coins || []).find(
        (c) =>
          c.symbol?.toLowerCase() === sym ||
          c.id?.toLowerCase() === sym ||
          c.name?.toLowerCase() === sym
      );
      if (hit?.id) return { id: hit.id, name: hit.name, symbol: hit.symbol };
    }
  } catch {}

  // 2) fallback /coins/list (pode ser pesado; usa pequena demora se cair aqui)
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/coins/list", {
      cache: "force-cache",
    });
    if (r.ok) {
      const list = await r.json();
      const exact =
        list.find((c) => c.symbol?.toLowerCase() === sym) ||
        list.find((c) => c.id?.toLowerCase() === sym) ||
        list.find((c) => c.name?.toLowerCase() === sym);
      if (exact) return { id: exact.id, name: exact.name, symbol: exact.symbol };
    }
  } catch {}

  return null;
}

async function fetchPriceEUR(coinId) {
  if (!coinId) return null;
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
        coinId
      )}&vs_currencies=eur`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const val = j?.[coinId]?.eur;
    return typeof val === "number" ? val : null;
  } catch {
    return null;
  }
}

/** ======= COMPONENT ======= */
export default function InvestimentosPage() {
  /** assets: [{ id, symbol, cgId, name, qty, avg, color }] */
  const [assets, setAssets] = useState([]);
  /** prices: map cgId -> priceEUR */
  const [prices, setPrices] = useState({});
  /** UI */
  const [form, setForm] = useState({
    symbol: "",
    qty: "",
    avg: "",
    color: "#22c55e",
  });
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const visibleRef = useRef(true);

  /** load LS */
  useEffect(() => {
    setAssets(lsGet(LS_ASSETS, []));
  }, []);

  /** auto refresh preços (a cada 60s quando aba ativa) */
  useEffect(() => {
    const handler = () => {
      visibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handler);

    let stop = false;
    const loop = async () => {
      while (!stop) {
        if (visibleRef.current) {
          await refreshAllPrices();
        }
        await sleep(60000);
      }
    };
    loop();

    return () => {
      stop = true;
      document.removeEventListener("visibilitychange", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.map((a) => a.cgId).join(",")]);

  /** primeira carga de preços logo que houver assets */
  useEffect(() => {
    refreshAllPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.map((a) => a.cgId).join(",")]);

  /** cálculos */
  const enriched = useMemo(() => {
    return assets.map((a) => {
      const px = prices[a.cgId] ?? null;
      const qty = Number(a.qty || 0);
      const avg = Number(a.avg || 0);
      const current = px ?? 0;
      const currentVal = qty * current;
      const cost = qty * avg;
      const pl = currentVal - cost;
      const plPct = cost > 0 ? (pl / cost) * 100 : 0;
      return {
        ...a,
        current,
        currentVal,
        cost,
        pl,
        plPct,
      };
    });
  }, [assets, prices]);

  const totalCost = useMemo(
    () => enriched.reduce((s, it) => s + it.cost, 0),
    [enriched]
  );
  const totalVal = useMemo(
    () => enriched.reduce((s, it) => s + it.currentVal, 0),
    [enriched]
  );
  const totalPL = totalVal - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  /** actions */
  async function addAsset(e) {
    e.preventDefault();
    const symbol = form.symbol.trim();
    if (!symbol) {
      alert("Informe o símbolo (ex.: BTC, ETH, ORAI, WLD…).");
      return;
    }

    setLoading(true);
    const resolved = await resolveIdFromSymbol(symbol);
    setLoading(false);

    if (!resolved?.id) {
      alert(
        "Não consegui encontrar esse símbolo na CoinGecko. Verifique se está correto."
      );
      return;
    }

    const next = [
      ...assets,
      {
        id: uid(),
        symbol: symbol.toUpperCase(),
        cgId: resolved.id,
        name: resolved.name || symbol.toUpperCase(),
        qty: Number(form.qty || 0),
        avg: Number(form.avg || 0),
        color: form.color || "#22c55e",
        createdAt: Date.now(),
      },
    ];
    setAssets(next);
    lsSet(LS_ASSETS, next);
    setForm({ symbol: "", qty: "", avg: "", color: "#22c55e" });
  }

  function removeAsset(id) {
    const next = assets.filter((a) => a.id !== id);
    setAssets(next);
    lsSet(LS_ASSETS, next);
  }

  async function refreshAllPrices() {
    if (!assets.length) return;
    // busca em lotes pequenos para evitar rate limit
    const ids = [...new Set(assets.map((a) => a.cgId).filter(Boolean))];
    const newMap = { ...prices };
    for (const id of ids) {
      const val = await fetchPriceEUR(id);
      if (typeof val === "number") newMap[id] = val;
      // pequena pausa para ser “amigável” com a API
      await sleep(250);
    }
    setPrices(newMap);
  }

  function exportCSV() {
    const rows = enriched.map((a) => ({
      Ativo: a.symbol,
      Nome: a.name,
      Quantidade: a.qty,
      "Preço médio": a.avg,
      "Preço atual (EUR)": a.current,
      "Valor atual (EUR)": a.currentVal,
      "Custo (EUR)": a.cost,
      "P/L (EUR)": a.pl,
      "P/L (%)": `${a.plPct.toFixed(2)}%`,
    }));
    const header = Object.keys(rows[0] || {});
    const lines = [
      header.join(";"),
      ...rows.map((r) =>
        header.map((h) => String(r[h]).replaceAll(";", ",")).join(";")
      ),
    ].join("\n");

    const blob = new Blob([lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "carteira.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** UI */
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
        Investimentos
      </h1>

      {/* resumo */}
      <div style={grid2}>
        <div className="card" style={card}>
          <div style={pillRow}>
            <Pill label="Valor total" value={fmt(totalVal)} />
            <Pill label="Custo total" value={fmt(totalCost)} />
            <Pill
              label="P/L não realizado"
              value={`${fmt(totalPL)} (${totalPLPct.toFixed(2)}%)`}
              tone={totalPL >= 0 ? "up" : "down"}
            />
          </div>

          {/* tabela carteira */}
          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={{ minWidth: 90 }}>Ativo</th>
                  <th>Qtd</th>
                  <th>Preço méd.</th>
                  <th>Preço atual</th>
                  <th>Valor atual</th>
                  <th>P/L</th>
                  <th style={{ width: 90 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {enriched.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 18, opacity: .7 }}>
                      Adicione seus criptoativos ao lado para ver a carteira.
                    </td>
                  </tr>
                ) : (
                  enriched.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            aria-hidden
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              background: a.color || "#22c55e",
                              outline: "1px solid rgba(0,0,0,.06)",
                            }}
                          />
                          <div style={{ lineHeight: 1.2 }}>
                            <div style={{ fontWeight: 600 }}>{a.symbol}</div>
                            <small style={{ opacity: .7 }}>{a.name}</small>
                          </div>
                        </div>
                      </td>
                      <td>{a.qty}</td>
                      <td>{fmt(a.avg)}</td>
                      <td>{a.current ? fmt(a.current) : "—"}</td>
                      <td>{fmt(a.currentVal)}</td>
                      <td>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: a.pl >= 0 ? "#dcfce7" : "#fee2e2",
                            color: a.pl >= 0 ? "#166534" : "#991b1b",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {fmt(a.pl)} ({a.plPct.toFixed(2)}%)
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <button style={btnDanger} onClick={() => removeAsset(a.id)}>
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
            <button style={btnSoft} onClick={exportCSV}>
              Exportar CSV (filtro)
            </button>
          </div>
        </div>

        {/* formulário */}
        <form onSubmit={addAsset} className="card" style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Adicionar ativo</div>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label className="lbl">Símbolo (ex.: BTC, ETH, ORAI, WLD)</label>
                <input
                  value={form.symbol}
                  onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))}
                  placeholder="Símbolo"
                  style={input}
                  required
                />
              </div>
              <div>
                <label className="lbl">Quantidade</label>
                <input
                  value={form.qty}
                  onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))}
                  placeholder="Quantidade"
                  inputMode="decimal"
                  style={input}
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label className="lbl">Preço médio (EUR)</label>
                <input
                  value={form.avg}
                  onChange={(e) => setForm((p) => ({ ...p, avg: e.target.value }))}
                  placeholder="Preço médio em EUR"
                  inputMode="decimal"
                  style={input}
                  required
                />
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <div style={{ display: "grid" }}>
                  <label className="lbl">Cor</label>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                    style={{ height: 36, width: 60, padding: 0, border: "1px solid #e5e7eb", borderRadius: 8 }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
              <button type="submit" style={btnPrimary} disabled={loading}>
                {loading ? "Adicionando…" : "Salvar"}
              </button>
            </div>
          </div>

          <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7, textAlign: "center" }}>
            Cotações via CoinGecko. Se um símbolo não for encontrado, verifique a sigla.
            Atualiza automaticamente quando a aba está em primeiro plano.
          </p>
        </form>
      </div>
    </div>
  );
}

/** ======= styles (inline tokens) ======= */
const card = {
  background: "var(--card-bg, #fff)",
  border: "1px solid var(--card-bd, #e5e7eb)",
  borderRadius: 14,
  padding: 14,
  boxShadow: "0 1px 2px rgba(0,0,0,.04)",
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "1.4fr 0.9fr",
  gap: 16,
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};
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
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid transparent",
  cursor: "pointer",
};
const btnPrimary = { ...btnBase, background: "#2563eb", color: "#fff", borderColor: "#1d4ed8" };
const btnSoft = { ...btnBase, background: "#f3f4f6", color: "#111827", borderColor: "#e5e7eb" };
const btnDanger = { ...btnBase, background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" };

const pillRow = { display: "flex", gap: 12, flexWrap: "wrap" };

function Pill({ label, value, tone }) {
  let bg = "#f3f4f6", fg = "#111827";
  if (tone === "up") { bg = "#dcfce7"; fg = "#166534"; }
  if (tone === "down") { bg = "#fee2e2"; fg = "#991b1b"; }
  return (
    <div style={{
      display: "grid",
      gap: 2,
      padding: "8px 10px",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      minWidth: 140,
      background: bg,
      color: fg,
    }}>
      <span style={{ fontSize: 12, opacity: 0.7, color: "#6b7280" }}>{label}</span>
      <b style={{ fontSize: 15, color: fg }}>{value}</b>
    </div>
  );
}
