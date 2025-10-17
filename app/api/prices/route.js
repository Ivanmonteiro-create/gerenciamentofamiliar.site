export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { type, symbols = [], knownMap = {}, currency = "EUR" } = await req.json();

    if (type !== "crypto" || !Array.isArray(symbols) || symbols.length === 0) {
      return Response.json({ ok: true, data: {}, resolved: {} });
    }

    const uniq = Array.from(new Set(symbols.map(s => String(s || "").toUpperCase())));

    // 1) resolver ids CoinGecko (usa knownMap quando possível)
    const resolved = {}; // {SYM: {id, name}}
    const needSearch = [];

    for (const sym of uniq) {
      if (knownMap[sym]) {
        resolved[sym] = { id: knownMap[sym] };
      } else {
        needSearch.push(sym);
      }
    }

    // busca batelada para cada símbolo que falta
    for (const sym of needSearch) {
      try {
        const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`, {
          headers: { accept: "application/json" },
          // sem API key — respeitar rate-limit
        });
        const j = await r.json();
        const hit = (j?.coins || []).find(c => (c.symbol || "").toUpperCase() === sym);
        if (hit?.id) {
          resolved[sym] = { id: hit.id, name: hit.name };
        }
      } catch {}
    }

    const ids = Object.values(resolved).map(x => x.id).filter(Boolean);
    if (ids.length === 0) {
      return Response.json({ ok: true, data: {}, resolved });
    }

    // 2) pegar preços simples em EUR/USD/BRL
    const priceRes = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=eur,usd,brl`,
      { headers: { accept: "application/json" } }
    );
    const prices = await priceRes.json(); // {id: {eur,usd,brl}}

    // 3) remontar por símbolo
    const data = {}; // {SYM: {eur,usd,brl}}
    for (const [sym, info] of Object.entries(resolved)) {
      const { id } = info || {};
      if (id && prices[id]) {
        data[sym] = {
          eur: Number(prices[id].eur || 0),
          usd: Number(prices[id].usd || 0),
          brl: Number(prices[id].brl || 0),
        };
      }
    }

    return Response.json({ ok: true, data, resolved, currency });
  } catch (err) {
    return Response.json({ ok: false, error: err?.message || "error" }, { status: 500 });
  }
}
