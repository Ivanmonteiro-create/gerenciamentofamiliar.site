"use client";

import { useEffect, useMemo, useState } from "react";

/** ========= Storage & helpers ========= */
const KEY_ASSETS = "gf_invest_assets_v3";
const KEY_CG_MAP = "gf_cg_map_v2"; // {SYM: coingecko_id}

const load = (k, fb) => {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; }
};
const save = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-6);
const fmt = n => Number(n||0).toLocaleString("pt-PT",{style:"currency", currency:"EUR"});
const pct = (a,b)=> (Number(b||0) ? ((Number(a||0)/Number(b))*100).toFixed(2)+"%" : "0.00%");

/** Aceita vírgula ou ponto */
const toNumber = (s) => {
  if (typeof s === "number") return s;
  const t = String(s||"").replace(/\./g,"").replace(",","."); // "1.234,56" -> "1234.56"
  const n = parseFloat(t);
  return isFinite(n) ? n : 0;
};

const TYPE_LABEL = { crypto: "Cripto", stock: "Ação", other: "Outro" };

export default function InvestimentosPage() {
  const [assets, setAssets] = useState([]);
  const [cgMap, setCgMap] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [lastTs, setLastTs] = useState(null);

  // form
  const [form, setForm] = useState({
    type: "crypto",
    symbol: "",
    name: "",
    qty: "",
    avgPrice: "",
    manualPrice: "",
    color: "#22c55e",
    cgId: "", // se o usuário escolher explicitamente pelo buscador
  });

  // busca CoinGecko
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchRes, setSearchRes] = useState([]);

  /** load/save */
  useEffect(()=>{ setAssets(load(KEY_ASSETS, [])); setCgMap(load(KEY_CG_MAP, {})); },[]);
  useEffect(()=>{ save(KEY_ASSETS, assets); },[assets]);
  useEffect(()=>{ save(KEY_CG_MAP, cgMap); },[cgMap]);

  /** símbolos/ids para crypto */
  const cryptoSyms = useMemo(
    ()=> Array.from(new Set(assets.filter(a=>a.type==="crypto").map(a=>(a.symbol||"").toUpperCase()).filter(Boolean))),
    [assets]
  );
  const cryptoIds = useMemo(
    ()=> Array.from(new Set(assets.filter(a=>a.type==="crypto").map(a=>a.cgId).filter(Boolean))),
    [assets]
  );

  /** Atualiza preços ao vivo */
  useEffect(()=>{
    let cancel=false;
    async function go() {
      if (cryptoSyms.length===0 && cryptoIds.length===0) return;
      setLoadingPrices(true);
      try {
        const knownMap = {...cgMap}; // SYM -> id
        const r = await fetch("/api/prices", {
          method:"POST",
          headers:{ "content-type":"application/json" },
          body: JSON.stringify({ type:"crypto", symbols: cryptoSyms, ids: cryptoIds, knownMap })
        }).then(r=>r.json());

        if (r?.ok) {
          // guardar resolvidos
          const resolved = r.resolved || {};
          const newMap = { ...cgMap };
          Object.entries(resolved).forEach(([sym, info])=>{
            if (info?.id) newMap[sym.toUpperCase()] = info.id;
          });

          if (!cancel) {
            setCgMap(newMap);
            const dataBySym = r?.data?.bySymbol || {};
            const dataById = r?.data?.byId || {};
            setLastTs(r.ts || Date.now());
            setAssets(prev => prev.map(a=>{
              if (a.type!=="crypto") return a;
              const sym = (a.symbol||"").toUpperCase();
              const fromId = a.cgId && dataById[a.cgId] ? dataById[a.cgId].eur : null;
              const fromSym = dataBySym[sym]?.eur ?? null;
              const live = (typeof fromId === "number") ? fromId : (typeof fromSym === "number" ? fromSym : null);
              return { ...a, livePrice: live };
            }));
          }
        }
      } catch {}
      finally { if(!cancel) setLoadingPrices(false); }
    }
    go();
    const t = setInterval(go, 60_000);
    return ()=>{ cancel=true; clearInterval(t); };
  },[cryptoSyms, cryptoIds]); // eslint-disable-line

  /** totais */
  const totals = useMemo(()=>{
    let cost=0, now=0;
    for (const a of assets) {
      const qty = toNumber(a.qty);
      const avg = toNumber(a.avgPrice);
      const invested = qty*avg;
      cost += invested;

      const price = a.type==="crypto"
        ? toNumber(a.livePrice)
        : toNumber(a.manualPrice);
      now += qty*price;
    }
    return { cost, now, pnl: now-cost, pnlPct: pct(now-cost, cost) };
  },[assets]);

  /** add/remove */
  function addAsset(e){
    e.preventDefault();
    const symbol = (form.symbol||"").trim().toUpperCase();
    if (!symbol) { alert("Informe o símbolo."); return; }
    const newA = {
      id: uid(),
      type: form.type,
      symbol,
      name: (form.name||"").trim(),
      qty: toNumber(form.qty),
      avgPrice: toNumber(form.avgPrice),
      manualPrice: form.type==="crypto" ? undefined : toNumber(form.manualPrice),
      color: form.color || "#22c55e",
      livePrice: null,
      cgId: (form.type==="crypto" ? (form.cgId||"") : ""),
      createdAt: Date.now(),
    };
    setAssets(a=>[newA, ...a]);
    setForm({ type:"crypto", symbol:"", name:"", qty:"", avgPrice:"", manualPrice:"", color:"#22c55e", cgId:"" });
  }
  function removeAsset(id){
    if(!confirm("Excluir este ativo?")) return;
    setAssets(a=>a.filter(x=>x.id!==id));
  }

  /** helpers linha */
  const rowCost = a => toNumber(a.qty)*toNumber(a.avgPrice);
  const rowNow = a => toNumber(a.qty) * (a.type==="crypto" ? toNumber(a.livePrice) : toNumber(a.manualPrice));

  /** busca CoinGecko */
  async function doSearch(){
    const q = (searchQ||"").trim();
    if (!q) { setSearchRes([]); return; }
    const r = await fetch("/api/prices", {
      method:"POST",
      headers:{ "content-type":"application/json" },
      body: JSON.stringify({ type:"search", query:q })
    }).then(r=>r.json());
    setSearchRes(r?.results||[]);
  }
  useEffect(()=>{ const t=setTimeout(doSearch, 350); return ()=>clearTimeout(t); },[searchQ]); // debounce

  /** render */
  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontSize:28, fontWeight:700, marginBottom:12 }}>Investimentos</h1>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14 }}>
        <KPI label="Valor atual" value={fmt(totals.now)} />
        <KPI label="Custo total" value={fmt(totals.cost)} />
        <KPI label="P/L não realizado" value={`${fmt(totals.pnl)} (${totals.pnlPct})`} tone={totals.pnl>=0?"up":"down"} />
      </div>

      {/* fonte e horário */}
      <div style={{ fontSize:12, color:"#6b7280", marginBottom:8 }}>
        {loadingPrices ? "Atualizando preços..." :
          lastTs ? `Preços: CoinGecko • ${new Date(lastTs).toLocaleTimeString()}` : "Preços: CoinGecko"}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.2fr .9fr", gap:14 }}>
        {/* carteira */}
        <div style={cardBox}>
          <div style={{ fontWeight:700, marginBottom:8 }}>Carteira</div>
          <div style={{ overflowX:"auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={{ minWidth:120, textAlign:"left" }}>Ativo</th>
                  <th>Tipo</th>
                  <th>Qtd</th>
                  <th>Preço médio</th>
                  <th>Preço atual</th>
                  <th>Valor atual</th>
                  <th>P/L</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {assets.length===0 ? (
                  <tr><td colSpan={8} style={{ padding:14, textAlign:"center", opacity:.6 }}>Nenhum ativo.</td></tr>
                ) : assets.map(a=>{
                  const cost = rowCost(a);
                  const nowv = rowNow(a);
                  const pl = nowv - cost;
                  const priceAtual = a.type==="crypto"
                    ? (a.livePrice!=null ? fmt(a.livePrice) : "—")
                    : fmt(a.manualPrice||0);

                  return (
                    <tr key={a.id}>
                      <td style={{ textAlign:"left" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ width:10, height:10, borderRadius:999, background:a.color }} />
                          <div>
                            <div style={{ fontWeight:600 }}>{a.symbol}</div>
                            {a.name ? <div style={{ fontSize:12, opacity:.7 }}>{a.name}</div> : null}
                          </div>
                        </div>
                      </td>
                      <td>{TYPE_LABEL[a.type]||a.type}</td>
                      <td>{toNumber(a.qty).toLocaleString("pt-PT")}</td>
                      <td>{fmt(a.avgPrice)}</td>
                      <td>{priceAtual}</td>
                      <td>{fmt(nowv)}</td>
                      <td>
                        <Badge tone={pl>=0 ? "up":"down"}>{fmt(pl)} ({pct(pl,cost)})</Badge>
                      </td>
                      <td><button style={btnDanger} onClick={()=>removeAsset(a.id)}>Excluir</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* adicionar */}
        <form onSubmit={addAsset} style={cardBox}>
          <div style={{ fontWeight:700, marginBottom:8 }}>Adicionar ativo</div>
          <div style={{ display:"grid", gap:8 }}>
            {/* tipo */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12, opacity:.8 }}>Tipo</span>
              <div style={{ display:"flex", gap:10 }}>
                {["crypto","stock","other"].map(t=>(
                  <label key={t} style={{ display:"flex", gap:6, alignItems:"center", fontSize:13 }}>
                    <input type="radio" checked={form.type===t} onChange={()=>setForm(p=>({...p, type:t}))} />
                    {TYPE_LABEL[t]}
                  </label>
                ))}
              </div>
            </div>

            {/* símbolo / nome + buscador CG */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div style={{ display:"grid", gap:6 }}>
                <div style={{ display:"flex", gap:8 }}>
                  <input
                    placeholder={form.type==="crypto" ? "Símbolo (ex.: BTC)" : "Símbolo/Ticker"}
                    value={form.symbol}
                    onChange={e=>setForm(p=>({...p, symbol:e.target.value.toUpperCase()}))}
                    style={input}
                    required
                  />
                  {form.type==="crypto" && (
                    <button
                      type="button"
                      onClick={()=>{ setSearchOpen(true); setSearchQ(form.symbol || ""); }}
                      style={btnSoft}>
                      Buscar
                    </button>
                  )}
                </div>
                <input
                  placeholder="Nome (opcional)"
                  value={form.name}
                  onChange={e=>setForm(p=>({...p, name:e.target.value}))}
                  style={input}
                />
              </div>
              <div />
            </div>

            {/* quantidade / preço médio */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <input
                placeholder="Quantidade"
                value={form.qty}
                onChange={e=>setForm(p=>({...p, qty:e.target.value}))}
                style={input}
                inputMode="decimal"
                required
              />
              <input
                placeholder="Preço médio (€)"
                value={form.avgPrice}
                onChange={e=>setForm(p=>({...p, avgPrice:e.target.value}))}
                style={input}
                inputMode="decimal"
                required
              />
            </div>

            {/* preço manual pra ações/outro */}
            {form.type!=="crypto" && (
              <input
                placeholder="Preço atual (€) — manual"
                value={form.manualPrice}
                onChange={e=>setForm(p=>({...p, manualPrice:e.target.value}))}
                style={input}
                inputMode="decimal"
              />
            )}

            {/* cor */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, opacity:.8 }}>Cor</span>
              <input
                type="color"
                value={form.color}
                onChange={e=>setForm(p=>({...p, color:e.target.value}))}
                style={{ width:48, height:28, border:"1px solid #e5e7eb", borderRadius:8 }}
              />
            </div>

            <div style={{ textAlign:"right" }}>
              <button type="submit" style={btnPrimary}>Salvar</button>
            </div>

            <small style={{ color:"#6b7280" }}>
              Criptos: preço via CoinGecko. Ações/Outros: informe preço manual por enquanto. Campos aceitam vírgula (ex.: 2,86).
            </small>
          </div>
        </form>
      </div>

      {/* Modal de busca CoinGecko */}
      {searchOpen && (
        <div style={modalBackdrop} onClick={()=>setSearchOpen(false)}>
          <div style={modalPanel} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
              <input
                autoFocus
                placeholder="Buscar no CoinGecko (nome ou símbolo)"
                value={searchQ}
                onChange={e=>setSearchQ(e.target.value)}
                style={input}
              />
              <button style={btnSoft} onClick={doSearch}>Procurar</button>
              <button style={btnDanger} onClick={()=>setSearchOpen(false)}>Fechar</button>
            </div>
            <div style={{ maxHeight:300, overflowY:"auto", border:"1px solid #e5e7eb", borderRadius:10 }}>
              {(searchRes||[]).length===0 ? (
                <div style={{ padding:12, fontSize:13, color:"#6b7280" }}>Sem resultados…</div>
              ) : searchRes.map(it=>(
                <div key={it.id}
                  onClick={()=>{
                    setForm(p=>({ ...p, symbol:(it.symbol||"").toUpperCase(), name: it.name||"", cgId: it.id }));
                    setSearchOpen(false);
                  }}
                  style={{ padding:10, cursor:"pointer", borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between" }}>
                  <span><b>{(it.symbol||"").toUpperCase()}</b> — {it.name}</span>
                  <span style={{ fontSize:12, color:"#6b7280" }}>{it.id}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** ========== UI tokens ========== */
const cardBox = {
  background: "var(--card-bg, #fff)",
  border: "1px solid var(--card-bd, #e5e7eb)",
  borderRadius: 14,
  padding: 14,
  boxShadow: "0 1px 2px rgba(0,0,0,.04)",
};
const table = { width:"100%", borderCollapse:"collapse", fontSize:14, textAlign:"center" };
const input = { display:"inline-block", width:"100%", height:36, padding:"0 10px", borderRadius:10, border:"1px solid #e5e7eb", background:"var(--input-bg,#fff)", outline:"none" };
const btnBase = { height:34, padding:"0 12px", borderRadius:10, border:"1px solid transparent", cursor:"pointer" };
const btnPrimary = { ...btnBase, background:"#2563eb", color:"#fff", borderColor:"#1d4ed8" };
const btnSoft    = { ...btnBase, background:"#f3f4f6", color:"#111827", borderColor:"#e5e7eb" };
const btnDanger  = { ...btnBase, background:"#fee2e2", color:"#991b1b", borderColor:"#fecaca" };

function KPI({ label, value, tone }) {
  const color = tone==="up" ? "#166534" : tone==="down" ? "#991b1b" : "#111827";
  const bg    = tone==="up" ? "#dcfce7" : tone==="down" ? "#fee2e2" : "#f3f4f6";
  return (
    <div style={{ ...cardBox, padding:12, display:"grid", gap:4 }}>
      <span style={{ fontSize:12, color:"#6b7280" }}>{label}</span>
      <b style={{ fontSize:18, color }}>{value}</b>
      {tone && <div style={{ background:bg, borderRadius:10, height:6 }} />}
    </div>
  );
}
function Badge({ tone="neutral", children }){
  const bg = tone==="up" ? "#dcfce7" : tone==="down" ? "#fee2e2" : "#e5e7eb";
  const color = tone==="up" ? "#166534" : tone==="down" ? "#991b1b" : "#111827";
  return <span style={{ padding:"2px 8px", borderRadius:999, background:bg, color, fontSize:12 }}>{children}</span>;
}

const modalBackdrop = {
  position:"fixed", inset:0, background:"rgba(0,0,0,.35)", display:"grid", placeItems:"center", zIndex:50
};
const modalPanel = {
  width: 620, background:"#fff", borderRadius:14, padding:14, boxShadow:"0 10px 30px rgba(0,0,0,.25)"
};
