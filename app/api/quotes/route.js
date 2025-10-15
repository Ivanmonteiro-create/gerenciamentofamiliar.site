import { NextResponse } from "next/server";

/**
 * /api/quotes?assets=BTC,ETH,AAPL&currency=EUR
 * Retorna: { quotes: { BTC: { price, change24h, currency, spark }, ... } }
 *
 * - Cripto: CoinGecko (sem chave)
 * - Ações: Alpha Vantage (requer chave em process.env.ALPHAVANTAGE_KEY) – opcional
 */

const CRYPTO_MAP = {
  BTC: "bitcoin",
  ETH: "ethereum",
  ADA: "cardano",
  SOL: "solana",
  XRP: "ripple",
  DOGE: "dogecoin",
  MATIC: "matic-network",
  DOT: "polkadot",
  BNB: "binancecoin",
  LTC: "litecoin",
  AVAX: "avalanche-2",
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const assets = (searchParams.get("assets") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const currency = (searchParams.get("currency") || "EUR").toUpperCase();

  if (!assets.length) {
    return NextResponse.json({ quotes: {} }, { headers: cacheHdr(5) });
  }

  const cryptoSymbols = assets.filter((s) => CRYPTO_MAP[s]);
  const stockSymbols = assets.filter((s) => !CRYPTO_MAP[s]);

  const out = {};

  // ------ CRIPTO (CoinGecko) ------
  if (cryptoSymbols.length) {
    const ids = cryptoSymbols.map((s) => CRYPTO_MAP[s]).join(",");
    try {
      const u = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${currency.toLowerCase()}&include_24hr_change=true`;
      const r = await fetch(u, { next: { revalidate: 20 } });
      const j = await r.json();

      // sparkline rápido: 7 dias para 1º cripto, para as demais retornamos vazio (economia de chamadas)
      for (const sym of cryptoSymbols) {
        const id = CRYPTO_MAP[sym];
        const price = j?.[id]?.[currency.toLowerCase()] ?? null;
        const change24h = j?.[id]?.[`${currency.toLowerCase()}_24h_change`] ?? null;

        let spark = [];
        try {
          const hU = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=${currency.toLowerCase()}&days=7`;
          const hR = await fetch(hU, { next: { revalidate: 600 } });
          const hJ = await hR.json();
          spark = (hJ?.prices || []).map((p) => p[1]).slice(-50);
        } catch {}

        out[sym] = {
          price,
          change24h,
          currency,
          spark,
        };
      }
    } catch {}
  }

  // ------ AÇÕES (Alpha Vantage opcional) ------
  const AV_KEY = process.env.ALPHAVANTAGE_KEY;
  if (stockSymbols.length && AV_KEY) {
    // Rate-limit amigável: resolve em série
    for (const sym of stockSymbols) {
      try {
        const u = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
          sym
        )}&apikey=${AV_KEY}`;
        const r = await fetch(u, { cache: "no-store" });
        const j = await r.json();
        const q = j?.["Global Quote"] || {};
        const priceUSD = Number(q["05. price"] || 0);
        const changePct = Number(q["10. change percent"]?.replace("%", "") || 0);

        // converte USD->currency se preciso (EUR)
        let price = priceUSD;
        if (currency !== "USD") {
          const fx = await fxConvert("USD", currency);
          price = priceUSD * (fx || 1);
        }

        out[sym] = {
          price,
          change24h: changePct,
          currency,
          spark: [], // pode ser preenchido via /api/history se quiser
        };
      } catch {}
    }
  } else {
    // sem chave: devolve placeholder vazio para ações
    for (const sym of stockSymbols) {
      out[sym] = { price: null, change24h: null, currency, spark: [] };
    }
  }

  return NextResponse.json(
    { quotes: out },
    { headers: cacheHdr(20) }
  );
}

/** util: FX simples via exchangerate.host (cache 24h) */
async function fxConvert(base, to) {
  try {
    const u = `https://api.exchangerate.host/latest?base=${base}&symbols=${to}`;
    const r = await fetch(u, { next: { revalidate: 86400 } });
    const j = await r.json();
    return j?.rates?.[to] || null;
  } catch {
    return null;
  }
}

function cacheHdr(seconds) {
  return { "Cache-Control": `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}` };
}
