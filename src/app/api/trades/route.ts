import { NextRequest, NextResponse } from "next/server";
import { readBoundedJson } from "@/lib/http";
import { isEvmAddress, ROBINHOOD_CHAIN, TRADE_ASSETS } from "@/lib/robinhood";
import { fetchActiveTradeResponse, parseActiveTradesPayload } from "@/lib/trades";

export const dynamic = "force-dynamic";

const REFERENCE_TRADER = "0xB01563b292657D3BAA82a2D62EFA7679765CB718";
const REFERENCE_PERFORMANCE = {
  status: "profitable",
  pnlUsd: 47.57,
  roiPct: 0.0247,
  swapCount: 445,
  notionalUsd: 192312.66,
  verifiedAt: "2026-07-21T14:40:55.000Z",
  methodology: "24h net swap inflows minus outflows, marked using current Blockscout token rates; wrapped assets valued at their underlying token rate.",
} as const;
const MAX_BODY_BYTES = 120_000;
const rateBuckets = new Map<string, { reset: number; count: number }>();
type TradeResult = { payload: Record<string, unknown>; status: number; ttl: number };
let cache: { expires: number; result: TradeResult } | null = null;
let inFlight: Promise<TradeResult> | null = null;

function configuredWallet() {
  const configured = process.env.STOCKCAT_TRADER_ADDRESS?.trim();
  if (configured && isEvmAddress(configured)) return { address: configured, mode: "official" as const };
  return { address: REFERENCE_TRADER, mode: "reference" as const };
}

function clientKey(request: NextRequest): string {
  return (request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim().slice(0, 80);
}

function rateLimited(request: NextRequest): boolean {
  const now = Date.now();
  for (const [key, value] of rateBuckets) if (value.reset <= now) rateBuckets.delete(key);
  while (rateBuckets.size >= 500) {
    const oldest = rateBuckets.keys().next().value;
    if (oldest === undefined) break;
    rateBuckets.delete(oldest);
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

async function buildTrades(): Promise<TradeResult> {
  const wallet = configuredWallet();
  try {
    const response = await fetchActiveTradeResponse(`${ROBINHOOD_CHAIN.explorer}/api/v2/addresses/${wallet.address}/token-transfers?type=ERC-20`);
    const trades = parseActiveTradesPayload(await readBoundedJson(response, MAX_BODY_BYTES), wallet.address, TRADE_ASSETS, 100).slice(0, 10).map((trade) => ({
      ...trade,
      explorerUrl: `${ROBINHOOD_CHAIN.explorer}/tx/${trade.txHash}`,
    }));
    return {
      status: 200,
      ttl: 15_000,
      payload: {
        status: trades.length ? "available" : "empty",
        wallet: {
          address: wallet.address,
          mode: wallet.mode,
          label: wallet.mode === "official" ? "STOCKCAT TRADING WALLET" : "24H-PROFITABLE PUBLIC TRADER",
          explorerUrl: `${ROBINHOOD_CHAIN.explorer}/address/${wallet.address}`,
        },
        trades,
        performance24h: wallet.mode === "reference" ? REFERENCE_PERFORMANCE : null,
        observedAt: new Date().toISOString(),
        disclaimer: wallet.mode === "official" ? "Configured project trading wallet." : "Observed public trader with a positive verified 24h marked-to-current-price swap result. It is not owned or controlled by Stockcat.",
      },
    };
  } catch {
    return {
      status: 503,
      ttl: 10_000,
      payload: { status: "unavailable", wallet: { address: wallet.address, mode: wallet.mode }, trades: [], observedAt: new Date().toISOString(), error: "Live trade tape unavailable." },
    };
  }
}

function json(result: TradeResult) {
  return NextResponse.json(result.payload, { status: result.status, headers: { "Cache-Control": result.status === 200 ? "public, s-maxage=15, stale-while-revalidate=60" : "public, s-maxage=10" } });
}

export async function GET(request: NextRequest) {
  if (rateLimited(request)) return NextResponse.json({ error: "Too many trade reads.", code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "60" } });
  if (cache && cache.expires > Date.now()) return json(cache.result);
  if (!inFlight) inFlight = buildTrades().finally(() => { inFlight = null; });
  const result = await inFlight;
  cache = { expires: Date.now() + result.ttl, result };
  return json(result);
}
