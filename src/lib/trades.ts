import { formatUnits, isEvmAddress } from "./robinhood.ts";

export type TradeSide = "BUY" | "SELL";
export type ActiveTrade = {
  symbol: string;
  name: string;
  side: TradeSide;
  amount: string;
  priceUsd: number | null;
  estimatedValueUsd: number | null;
  timestamp: string;
  txHash: string;
  logIndex: number;
};

type TradeAsset = { address: string; symbol: string; name: string };
type UnknownRecord = Record<string, unknown>;
const INTEGER = /^\d{1,96}$/;
const HASH = /^0x[a-fA-F0-9]{64}$/;

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
class PermanentExplorerError extends Error {}

export async function fetchActiveTradeResponse(url: string, fetcher: Fetcher = fetch, attempts = 3, timeoutMs = 10_000): Promise<Response> {
  if (!/^https:\/\//.test(url) || !Number.isInteger(attempts) || attempts < 1 || attempts > 5 || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new Error("Invalid trade fetch configuration");
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetcher(url, {
        headers: { "User-Agent": "Stockcat/1.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const message = `Explorer HTTP ${response.status}`;
        if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) throw new PermanentExplorerError(message);
        throw new Error(message);
      }
      return response;
    } catch (error) {
      if (error instanceof PermanentExplorerError) throw error;
      lastError = error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Explorer unavailable");
}

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function addressFrom(value: unknown): string | null {
  const hash = record(value)?.hash;
  return typeof hash === "string" && isEvmAddress(hash) ? hash : null;
}

export function parseActiveTradesPayload(
  input: unknown,
  walletAddress: string,
  allowlist: ReadonlyArray<TradeAsset>,
  maxRows = 100,
): ActiveTrade[] {
  if (!isEvmAddress(walletAddress)) throw new Error("Invalid trade wallet");
  const payload = record(input);
  if (!Array.isArray(payload?.items)) throw new Error("Invalid trade response");
  if (payload.items.length > maxRows) throw new Error("Too many trade rows");

  const wallet = walletAddress.toLowerCase();
  const assets = new Map(allowlist.map((asset) => [asset.address.toLowerCase(), asset]));
  const seen = new Set<string>();
  const trades: ActiveTrade[] = [];

  for (const candidate of payload.items) {
    const row = record(candidate);
    if (!row || typeof row.method !== "string" || row.method.length > 80) throw new Error("Invalid trade row");
    if (row.method !== "swap") continue;
    const token = record(row.token);
    if (!token || typeof token.address_hash !== "string" || !isEvmAddress(token.address_hash)) throw new Error("Invalid trade row");
    const tokenAddress = token.address_hash.toLowerCase();
    const asset = assets.get(tokenAddress);
    if (!asset) continue;

    const from = addressFrom(row.from);
    const to = addressFrom(row.to);
    const total = record(row.total);
    const value = total?.value;
    const decimalsText = total?.decimals;
    const decimals = typeof decimalsText === "string" && /^\d{1,2}$/.test(decimalsText) ? Number(decimalsText) : NaN;
    const txHash = row.transaction_hash;
    const logIndex = row.log_index;
    const timestamp = row.timestamp;
    const rate = token?.exchange_rate;
    const priceUsd = typeof rate === "string" && rate.length <= 48 && Number.isFinite(Number(rate)) && Number(rate) >= 0 ? Number(rate) : null;
    const involved = from?.toLowerCase() === wallet || to?.toLowerCase() === wallet;
    const timestampValid = typeof timestamp === "string" && timestamp.length <= 40 && Number.isFinite(Date.parse(timestamp));

    if (!from || !to || !involved || typeof value !== "string" || !INTEGER.test(value) || !Number.isInteger(decimals) || decimals < 0 || decimals > 36 || typeof txHash !== "string" || !HASH.test(txHash) || !Number.isSafeInteger(logIndex) || (logIndex as number) < 0 || !timestampValid) {
      throw new Error("Invalid trade row");
    }

    const key = `${txHash.toLowerCase()}:${logIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const side: TradeSide = to.toLowerCase() === wallet ? "BUY" : "SELL";
    const numericAmount = Number(value) / (10 ** decimals);
    const rawValueUsd = priceUsd === null ? null : numericAmount * priceUsd;
    const estimatedValueUsd = rawValueUsd !== null && Number.isFinite(rawValueUsd) && rawValueUsd >= 0 ? Math.round(rawValueUsd * 100) / 100 : null;
    trades.push({
      symbol: asset.symbol,
      name: asset.name,
      side,
      amount: formatUnits(value, decimals, 4),
      priceUsd,
      estimatedValueUsd,
      timestamp: timestamp as string,
      txHash,
      logIndex: logIndex as number,
    });
  }
  return trades;
}

export type TradeTapePayload = {
  status: "available" | "empty";
  wallet: { address: string; mode: "official" | "reference"; label: string; explorerUrl: string };
  trades: Array<ActiveTrade & { explorerUrl: string }>;
  observedAt: string;
  disclaimer: string;
};

export function parseTradeTapePayload(input: unknown): TradeTapePayload {
  const payload = record(input);
  const wallet = record(payload?.wallet);
  if (!payload || (payload.status !== "available" && payload.status !== "empty") || !wallet || typeof wallet.address !== "string" || !isEvmAddress(wallet.address) || (wallet.mode !== "official" && wallet.mode !== "reference") || typeof wallet.label !== "string" || wallet.label.length > 80 || typeof wallet.explorerUrl !== "string" || !wallet.explorerUrl.startsWith("https://") || !Array.isArray(payload.trades) || payload.trades.length > 10 || typeof payload.observedAt !== "string" || !Number.isFinite(Date.parse(payload.observedAt)) || typeof payload.disclaimer !== "string" || payload.disclaimer.length > 240) throw new Error("Invalid trade tape");
  const trades = payload.trades.map((candidate) => {
    const trade = record(candidate);
    if (!trade || typeof trade.symbol !== "string" || trade.symbol.length > 20 || typeof trade.name !== "string" || trade.name.length > 80 || (trade.side !== "BUY" && trade.side !== "SELL") || typeof trade.amount !== "string" || !/^\d+(?:\.\d+)?$/.test(trade.amount) || (trade.priceUsd !== null && (typeof trade.priceUsd !== "number" || !Number.isFinite(trade.priceUsd) || trade.priceUsd < 0)) || (trade.estimatedValueUsd !== null && (typeof trade.estimatedValueUsd !== "number" || !Number.isFinite(trade.estimatedValueUsd) || trade.estimatedValueUsd < 0)) || typeof trade.timestamp !== "string" || !Number.isFinite(Date.parse(trade.timestamp)) || typeof trade.txHash !== "string" || !HASH.test(trade.txHash) || !Number.isSafeInteger(trade.logIndex) || (trade.logIndex as number) < 0 || typeof trade.explorerUrl !== "string" || !trade.explorerUrl.startsWith("https://")) throw new Error("Invalid trade tape");
    return trade as ActiveTrade & { explorerUrl: string };
  });
  return { status: payload.status, wallet: wallet as TradeTapePayload["wallet"], trades, observedAt: payload.observedAt, disclaimer: payload.disclaimer };
}
