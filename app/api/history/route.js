import { NextResponse } from "next/server";

/**
 * /api/history?asset=BTC&days=30&currency=EUR
 * - Cripto: CoinGecko market_chart
 * - Ações: Alpha Vantage TIME_SERIES_DAILY (se houver chave)
 */
const CRYPTO_MAP = {
  BTC: "bitcoin",
  ETH: "ethereum",
  ADA: "cardano",
  SOL: "solana",
  XRP: "ripple",
  DOGE: "dogecoin",
  BNB: "binancecoin",
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const asset = (searchParams.get("asset") || "").toUpperCase();
  const days = Number(searchParams.get("days") || 30);
  const currency = (searchParams.get("currency") || "EUR").toUpperCase();

  if (!asset) return NextResponse.json({ points: [] }, { headers: hdr(600) });

  // cripto
  if (CRYPTO_MAP[asset]) {
    try {
      const id = CRYPTO_MAP[asset];
      const u = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=${currency.toLowerCase()}&days=${days}`;
      const r = await fetch(u, { next: { revalidate: 600 } });
      const j = await r.json();
      const points = (j?.prices || []).map((p) => p[1]);
      return NextResponse.json({ points }, { headers: hdr(600) });
    } catch {
      return NextResponse.json({ points: [] }, { headers: hdr(60) });
    }
  }

  // ações (Alpha Vantage)
  const AV_KEY = process.env.ALPHAVANTAGE_KEY;
  if (AV_KEY) {
    try {
      const u = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${asset}&outputsize=compact&apikey=${AV_KEY}`;
      const r = await fetch(u, { cache: "no-store" });
      const j = await r.json();
      const series = j?.["Time Series (Daily)"] || {};
      const closes = Object.keys(series)
        .sort()
        .slice(-days)
        .map((d) => Number(series[d]["4. close"] || 0));
      // USD->currency?
      if (currency !== "USD") {
        const fxU = `https://api.exchangerate.host/latest?base=USD&symbols=${currency}`;
        const fxR = await fetch(fxU, { next: { revalidate: 86400 } });
        const fxJ = await fxR.json();
        const rate = fxJ?.rates?.[currency] || 1;
        return NextResponse.json({ points: closes.map((c) => c * rate) }, { headers: hdr(600) });
      }
      return NextResponse.json({ points: closes }, { headers: hdr(600) });
    } catch {
      return NextResponse.json({ points: [] }, { headers: hdr(60) });
    }
  }

  // sem chave -> vazio
  return NextResponse.json({ points: [] }, { headers: hdr(60) });
}

function hdr(s) {
  return { "Cache-Control": `public, s-maxage=${s}, stale-while-revalidate=${s * 2}` };
}
