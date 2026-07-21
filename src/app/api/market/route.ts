import { NextRequest, NextResponse } from "next/server";
import { readBoundedJson } from "@/lib/http";
import { ROBINHOOD_CHAIN, STOCK_ASSETS, parseTokenBalanceRows } from "@/lib/robinhood";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 65_536;
const rateBuckets = new Map<string, { reset: number; count: number }>();
type MarketResult = { payload: Record<string, unknown>; status: number; ttl: number };
let marketCache: { expires: number; result: MarketResult } | null = null;
let marketInFlight: Promise<MarketResult> | null = null;

function clientKey(request: NextRequest): string {
  return (request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim().slice(0, 80);
}

function rateLimited(request: NextRequest): boolean {
  const now = Date.now();
  if (rateBuckets.size >= 500) {
    for (const [key, value] of rateBuckets) if (value.reset <= now) rateBuckets.delete(key);
    while (rateBuckets.size >= 500) {
      const oldest = rateBuckets.keys().next().value;
      if (oldest === undefined) break;
      rateBuckets.delete(oldest);
    }
  }
  const key = clientKey(request);
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.reset <= now) {
    rateBuckets.set(key, { reset: now + 60_000, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 30;
}

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
      const rows = parseTokenBalanceRows([{ token: await readBoundedJson(response, MAX_BODY_BYTES), value: "0" }], 1);
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

async function buildMarket(): Promise<MarketResult> {
  const settled: PromiseSettledResult<Awaited<ReturnType<typeof fetchToken>>>[] = new Array(STOCK_ASSETS.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor < STOCK_ASSETS.length) {
      const index = cursor++;
      try { settled[index] = { status: "fulfilled", value: await fetchToken(STOCK_ASSETS[index].address) }; }
      catch (reason) { settled[index] = { status: "rejected", reason }; }
    }
  }));
  const availableCount = settled.filter((entry) => entry.status === "fulfilled").length;
  const observedAt = new Date().toISOString();
  if (availableCount === 0) return {
    status: 503,
    ttl: 10_000,
    payload: { chain: { id: ROBINHOOD_CHAIN.id, name: ROBINHOOD_CHAIN.name }, status: "unavailable", assets: [], observedAt },
  };
  const assets = STOCK_ASSETS.map((asset, index) => {
    const entry = settled[index];
    if (entry.status === "rejected") return { ...asset, status: "unavailable", priceUsd: null, holders: null, volume24hUsd: null, explorerUrl: `${ROBINHOOD_CHAIN.explorer}/token/${asset.address}` };
    const token = entry.value;
    return { ...asset, status: "available", priceUsd: safeNumber(token.exchange_rate), holders: safeNumber(token.holders_count), volume24hUsd: safeNumber(token.volume_24h), explorerUrl: `${ROBINHOOD_CHAIN.explorer}/token/${asset.address}` };
  });
  return {
    status: 200,
    ttl: 30_000,
    payload: { chain: { id: ROBINHOOD_CHAIN.id, name: ROBINHOOD_CHAIN.name }, status: availableCount === STOCK_ASSETS.length ? "available" : "partial", assets, observedAt },
  };
}

function response(result: MarketResult) {
  return NextResponse.json(result.payload, { status: result.status, headers: { "Cache-Control": result.status === 200 ? "public, s-maxage=60, stale-while-revalidate=300" : "public, s-maxage=10" } });
}

export async function GET(request: NextRequest) {
  if (marketCache && marketCache.expires > Date.now()) return response(marketCache.result);
  if (rateLimited(request)) return NextResponse.json({ error: "Too many market reads.", code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "60" } });
  if (!marketInFlight) marketInFlight = buildMarket().finally(() => { marketInFlight = null; });
  const result = await marketInFlight;
  marketCache = { expires: Date.now() + result.ttl, result };
  return response(result);
}
