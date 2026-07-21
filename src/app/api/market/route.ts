import { NextResponse } from "next/server";
import { ROBINHOOD_CHAIN, STOCK_ASSETS, parseTokenBalanceRows } from "@/lib/robinhood";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 65_536;

async function fetchToken(address: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${ROBINHOOD_CHAIN.explorer}/api/v2/tokens/${address}`, {
        headers: { "User-Agent": "Stockcat/1.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`Explorer HTTP ${response.status}`);
      const declared = Number(response.headers.get("content-length") ?? "0");
      if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new Error("Explorer response too large");
      const text = await response.text();
      if (text.length > MAX_BODY_BYTES) throw new Error("Explorer response too large");
      const rows = parseTokenBalanceRows([{ token: JSON.parse(text), value: "0" }], 1);
      if (rows.length !== 1) throw new Error("Invalid token metadata");
      return rows[0].token;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Explorer unavailable");
}

function safeNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export async function GET() {
  const settled = await Promise.allSettled(STOCK_ASSETS.map((asset) => fetchToken(asset.address)));
  const availableCount = settled.filter((entry) => entry.status === "fulfilled").length;
  if (availableCount === 0) {
    return NextResponse.json({
      chain: { id: ROBINHOOD_CHAIN.id, name: ROBINHOOD_CHAIN.name },
      status: "unavailable",
      assets: [],
      observedAt: new Date().toISOString(),
    }, { status: 503, headers: { "Cache-Control": "public, s-maxage=15" } });
  }
  const assets = STOCK_ASSETS.map((asset, index) => {
    const entry = settled[index];
    if (entry.status === "rejected") return { ...asset, status: "unavailable", priceUsd: null, holders: null, volume24hUsd: null, explorerUrl: `${ROBINHOOD_CHAIN.explorer}/token/${asset.address}` };
    const token = entry.value;
    return {
      ...asset,
      status: "available",
      priceUsd: safeNumber(token.exchange_rate),
      holders: safeNumber(token.holders_count),
      volume24hUsd: safeNumber(token.volume_24h),
      explorerUrl: `${ROBINHOOD_CHAIN.explorer}/token/${asset.address}`,
    };
  });
  return NextResponse.json({
    chain: { id: ROBINHOOD_CHAIN.id, name: ROBINHOOD_CHAIN.name },
    status: availableCount === STOCK_ASSETS.length ? "available" : "partial",
    assets,
    observedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
