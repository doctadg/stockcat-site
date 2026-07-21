import { NextRequest, NextResponse } from "next/server";
import {
  ROBINHOOD_CHAIN,
  STOCK_ASSETS,
  formatUnits,
  isEvmAddress,
  normalizeExcludedAddresses,
  parseTokenBalanceRows,
  safeProduct,
  type BlockscoutBalance,
} from "@/lib/robinhood";
import { readAttributionSnapshot } from "@/lib/rpc";

export const dynamic = "force-dynamic";

const EXPLORER = ROBINHOOD_CHAIN.explorer;
const MAX_BODY_BYTES = 262_144;
const cache = new Map<string, { expires: number; payload: PortfolioPayload }>();
const inFlight = new Map<string, Promise<PortfolioPayload>>();
const rateBuckets = new Map<string, { reset: number; count: number }>();

type PortfolioPayload = Record<string, unknown>;

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function nonNegativeInteger(value: unknown): string | null {
  return typeof value === "string" && /^\d{1,96}$/.test(value) ? value : null;
}

function rateLimited(request: NextRequest): boolean {
  const now = Date.now();
  const ip = (request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim().slice(0, 80);
  if (rateBuckets.size >= 500) {
    for (const [key, bucket] of rateBuckets) if (bucket.reset <= now) rateBuckets.delete(key);
    while (rateBuckets.size >= 500) {
      const oldest = rateBuckets.keys().next().value;
      if (oldest === undefined) break;
      rateBuckets.delete(oldest);
    }
  }
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.reset <= now) {
    rateBuckets.set(ip, { reset: now + 60_000, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 30;
}

async function explorerJson(path: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${EXPLORER}${path}`, {
        headers: { "User-Agent": "Stockcat/1.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`Explorer HTTP ${response.status}`);
      const declared = Number(response.headers.get("content-length") ?? "0");
      if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new Error("Explorer response too large");
      const text = await response.text();
      if (text.length > MAX_BODY_BYTES) throw new Error("Explorer response too large");
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Explorer unavailable");
}

async function balances(address: string): Promise<BlockscoutBalance[]> {
  return parseTokenBalanceRows(await explorerJson(`/api/v2/addresses/${address}/token-balances`));
}

function parseAccount(input: unknown) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid account response");
  const row = input as Record<string, unknown>;
  const coinBalance = nonNegativeInteger(row.coin_balance);
  const block = typeof row.block_number_balance_updated_at === "number" ? row.block_number_balance_updated_at : NaN;
  if (!coinBalance || !Number.isSafeInteger(block) || block < 0) throw new Error("Invalid account response");
  return { coinBalance, exchangeRate: finiteNumber(row.exchange_rate), block };
}

function publicAsset(row: BlockscoutBalance) {
  const decimals = Number(row.token.decimals);
  const amount = formatUnits(row.value, decimals, 6);
  const price = finiteNumber(row.token.exchange_rate);
  const exactAmount = Number(row.value) / 10 ** decimals;
  const valueUsd = safeProduct(Number.isFinite(exactAmount) ? exactAmount : null, price);
  return {
    address: row.token.address_hash,
    symbol: row.token.symbol,
    name: row.token.name,
    type: row.token.type,
    amount,
    rawAmount: row.value,
    decimals,
    iconUrl: row.token.icon_url,
    priceUsd: price,
    valueUsd,
    explorerUrl: `${EXPLORER}/token/${row.token.address_hash}`,
  };
}

async function buildPortfolio(address: string): Promise<PortfolioPayload> {
  const [walletRows, accountRaw] = await Promise.all([
    balances(address),
    explorerJson(`/api/v2/addresses/${address}`),
  ]);
  const account = parseAccount(accountRaw);
  const allWalletAssets = walletRows
    .filter((row) => BigInt(row.value) > 0n)
    .map(publicAsset)
    .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  const stockRegistry = new Set(STOCK_ASSETS.map((asset) => asset.address.toLowerCase()));
  const stockAssets = allWalletAssets.filter((asset) => stockRegistry.has(asset.address.toLowerCase()));

  const tokenContract = process.env.STOCKCAT_TOKEN_ADDRESS?.trim() ?? "";
  const vaultAddress = process.env.STOCKCAT_BUYBACK_VAULT_ADDRESS?.trim() ?? "";
  const enabled = process.env.STOCKCAT_ATTRIBUTION_ENABLED === "true";
  let buyback: Record<string, unknown> = {
    status: "unconfigured",
    holderShare: null,
    reason: "On-chain attribution activates only after the token, vault, and explicit operator enablement are configured.",
  };

  if (enabled) {
    if (!isEvmAddress(tokenContract) || !isEvmAddress(vaultAddress)) {
      buyback = { status: "misconfigured", holderShare: null, reason: "Attribution configuration is invalid." };
    } else {
      try {
        const exclusions = normalizeExcludedAddresses([
          vaultAddress,
          ...(process.env.STOCKCAT_EXCLUDED_ADDRESSES ?? "").split(",").map((item) => item.trim()).filter(Boolean),
        ]);
        const holderShare = await readAttributionSnapshot(tokenContract, vaultAddress, address, exclusions, process.env.STOCKCAT_TOKEN_SYMBOL ?? "$STOCKCAT");
        buyback = { status: "attribution-live", holderShare, snapshotBlock: holderShare.blockNumber };
      } catch (error) {
        console.error("Stockcat attribution unavailable", error instanceof Error ? error.message : "unknown error");
        buyback = { status: "unavailable", holderShare: null, reason: "A coherent on-chain attribution snapshot is temporarily unavailable." };
      }
    }
  }

  const eth = formatUnits(account.coinBalance, 18, 6);
  return {
    address,
    chain: { id: ROBINHOOD_CHAIN.id, name: ROBINHOOD_CHAIN.name, explorer: EXPLORER },
    blockNumber: account.block,
    nativeBalance: { symbol: "ETH", amount: eth, valueUsd: safeProduct(Number(eth), account.exchangeRate) },
    walletAssets: allWalletAssets.slice(0, 100),
    stockAssets,
    buyback,
    observedAt: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!isEvmAddress(address)) return NextResponse.json({ error: "Enter a valid 0x wallet address.", code: "INVALID_ADDRESS" }, { status: 400 });
  if (rateLimited(request)) return NextResponse.json({ error: "Too many wallet reads. Try again shortly.", code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "60" } });

  const key = address.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.payload, { headers: { "Cache-Control": "private, max-age=0" } });
  try {
    let pending = inFlight.get(key);
    if (!pending) {
      if (inFlight.size >= 100) return NextResponse.json({ error: "Wallet reads are temporarily saturated.", code: "OVERLOADED" }, { status: 503, headers: { "Retry-After": "15" } });
      pending = buildPortfolio(address).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    const payload = await pending;
    if (cache.size > 500) cache.clear();
    cache.set(key, { expires: Date.now() + 15_000, payload });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=0" } });
  } catch (error) {
    console.error("Stockcat portfolio unavailable", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Robinhood Chain data is temporarily unavailable.", code: "UPSTREAM_UNAVAILABLE" }, { status: 502 });
  }
}
