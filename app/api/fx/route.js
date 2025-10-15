import { NextResponse } from "next/server";

/** /api/fx?base=USD&to=EUR -> { rate }  */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const base = (searchParams.get("base") || "USD").toUpperCase();
  const to = (searchParams.get("to") || "EUR").toUpperCase();
  try {
    const u = `https://api.exchangerate.host/latest?base=${base}&symbols=${to}`;
    const r = await fetch(u, { next: { revalidate: 86400 } });
    const j = await r.json();
    const rate = j?.rates?.[to] || null;
    return NextResponse.json({ rate }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch {
    return NextResponse.json({ rate: null }, { headers: { "Cache-Control": "public, s-maxage=600" } });
  }
}
