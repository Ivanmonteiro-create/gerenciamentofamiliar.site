// app/api/prices/route.js
// Proxy de preços para o frontend.
// - Cripto: CoinGecko (com fallback de search -> id)
// - Ações/Outros: manual (não consulta aqui)

export const dynamic = "force-dynamic";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function resolveCoinGeckoIds(symbols) {
  // Retorna {SYM: { id, name }} tentando mapear por /search
  const out = {};
  for (const sym of symbols) {
    const q = encodeURIComponent(sym);
    const data = await fetchJson(`https://api.coingecko.com/api/v3/search?query=${q}`);
    // prioriza símbolo exato em crypto-currencies
    const match =
      (data.coins || []).find(c => (c.symbol || "").toLowerCase() === sym.toLowerCase()) ||
      (data.coins || [])[0];
    if (match?.id) out[sym] = { id: match.id, name: match.name };
  }
  return out;
}

async function fetchCoinGeckoPrices(ids) {
  // Retorna { id: { eur: number } }
  if (ids.length === 0) return {};
  const p = encodeURIComponent(ids.join(","));
  const json = await fetchJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${p}&vs_currencies=eur`
  );
  return json || {};
}

export async function POST(req) {
  try {
    const body = await req.json();
    // body: { type: 'crypto', symbols: ['BTC','WLD', ...], knownMap?: {SYM: cgId}}
    const { type, symbols = [], knownMap = {} } = body || {};

    if (type !== "crypto") {
      return new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
    }

    // 1) Descobrir ids que faltam
    const missing = symbols.filter(s => !knownMap[s]);
    const resolved = await resolveCoinGeckoIds(missing);
    const finalMap = { ...knownMap };
    for (const s of Object.keys(resolved)) finalMap[s] = resolved[s].id;

    // 2) Buscar preços por id
    const ids = Object.values(finalMap);
    const pricesById = await fetchCoinGeckoPrices(ids);

    // 3) Re-mapear para símbolo
    const data = {};
    for (const sym of symbols) {
      const cgId = finalMap[sym];
      const eur = cgId ? pricesById[cgId]?.eur : undefined;
      data[sym] = { id: cgId, eur: typeof eur === "number" ? eur : null };
    }

    return new Response(JSON.stringify({ ok: true, data, resolved }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
}
