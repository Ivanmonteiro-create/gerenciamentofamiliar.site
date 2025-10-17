// app/api/prices/route.js
import { NextResponse } from "next/server";

/**
 * POST /api/prices
 *
 * Usos:
 *  - Buscar preços de crypto (EUR):
 *      { type: "crypto", ids?: string[], symbols?: string[], knownMap?: {SYM: coingecko_id} }
 *    -> retorna { ok:true, data: { byId: {id:{eur}}, bySymbol:{SYM:{eur}} }, resolved:{SYM:{id,name}} , ts }
 *
 *  - Buscar sugestões de moedas (busca por nome/símbolo):
 *      { type: "search", query: "orai" }
 *    -> { ok:true, results: [ {id, symbol, name} ... ] }
 */

export async function POST(req) {
  try {
    const body = await req.json();

    // ---- Busca por sugestões (auto-complete) ----
    if (body?.type === "search") {
      const q = String(body?.query || "").trim();
      if (!q) return NextResponse.json({ ok: true, results: [] });
      const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`, {
        headers: { accept: "application/json" },
        next: { revalidate: 60 },
      });
      const js = await res.json();
      const results = (js?.coins || []).slice(0, 10).map(c => ({
        id: c.id,
        symbol: (c.symbol || "").toUpperCase(),
        name: c.name || "",
      }));
      return NextResponse.json({ ok: true, results });
    }

    // ---- Preços de crypto ----
    if (body?.type === "crypto") {
      const idsFromBody = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];
      const symbols = Array.isArray(body?.symbols) ? body.symbols.filter(Boolean) : [];
      const knownMap = body?.knownMap || {}; // {SYM: id}

      // 1) Resolver símbolos -> ids (usa mapa conhecido + /search para os faltantes)
      const needResolve = symbols
        .map(s => s.toUpperCase())
        .filter(sym => !knownMap[sym]);

      const resolved = { ...Object.fromEntries(Object.entries(knownMap).map(([k,v]) => [k.toUpperCase(), { id: v }])) };

      // resolve faltantes via /search
      for (const sym of needResolve) {
        try {
          const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`, {
            headers: { accept: "application/json" },
            next: { revalidate: 300 },
          });
          const js = await r.json();
          // regra: preferência por coincidência exata de símbolo; senão, o primeiro
          const coins = js?.coins || [];
          let pick = coins.find(c => (c.symbol || "").toUpperCase() === sym) || coins[0];
          if (pick?.id) {
            resolved[sym] = { id: pick.id, name: pick.name || "" };
          }
        } catch {}
      }

      // 2) Preparar lista final de ids
      const ids = new Set(idsFromBody);
      Object.values(resolved).forEach(o => o?.id && ids.add(o.id));
      if (ids.size === 0) return NextResponse.json({ ok: true, data: { byId: {}, bySymbol: {} }, resolved, ts: Date.now() });

      const idsCsv = Array.from(ids).join(",");
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(idsCsv)}&vs_currencies=eur`;

      // 3) Buscar preços
      const pr = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: 30 } });
      const pj = await pr.json();

      const byId = pj || {};
      const bySymbol = {};
      for (const [sym, obj] of Object.entries(resolved)) {
        const id = obj?.id;
        if (id && byId[id]) bySymbol[sym] = byId[id];
      }

      return NextResponse.json({ ok: true, data: { byId, bySymbol }, resolved, ts: Date.now() });
    }

    return NextResponse.json({ ok: false, error: "Tipo inválido" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
