import { ROBINHOOD_CHAIN, STOCK_ASSETS, assertValidSnapshot, formatUnits, proRataAllocation, sharePercent } from "./robinhood";
import { readBoundedJson } from "./http";

const UINT_HEX = /^0x[0-9a-fA-F]{1,64}$/;
const BALANCE_OF = "70a08231";
const TOTAL_SUPPLY = "0x18160ddd";
const DECIMALS = "0x313ce567";

interface RpcReply { id?: number; result?: unknown; error?: { message?: string } }

function balanceOfData(address: string): string {
  return `0x${BALANCE_OF}${address.toLowerCase().slice(2).padStart(64, "0")}`;
}

function uint(result: unknown): bigint {
  if (typeof result !== "string" || !UINT_HEX.test(result)) throw new Error("Invalid RPC uint response");
  return BigInt(result);
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(ROBINHOOD_CHAIN.rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Stockcat/1.0" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const payload = await readBoundedJson(response, 32_768) as RpcReply;
      if (payload.error || payload.result === undefined) throw new Error("RPC call failed");
      return payload.result;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("RPC unavailable");
}

async function rpcBatch(calls: { to: string; data: string }[], blockTag: string): Promise<bigint[]> {
  const body = calls.map((call, index) => ({ jsonrpc: "2.0", id: index + 1, method: "eth_call", params: [call, blockTag] }));
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(ROBINHOOD_CHAIN.rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Stockcat/1.0" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const replies = await readBoundedJson(response, 131_072) as RpcReply[];
      if (!Array.isArray(replies) || replies.length !== calls.length) throw new Error("Incomplete RPC batch");
      const byId = new Map(replies.map((reply) => [reply.id, reply]));
      return calls.map((_, index) => {
        const reply = byId.get(index + 1);
        if (!reply || reply.error) throw new Error("RPC batch call failed");
        return uint(reply.result);
      });
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("RPC unavailable");
}

export interface AttributionSnapshot {
  blockNumber: number;
  tokenSymbol: string;
  tokenAddress: string;
  vaultAddress: string;
  walletBalance: string;
  eligibleSupply: string;
  sharePercent: number;
  allocations: Array<{ address: string; symbol: string; name: string; amount: string; rawAmount: string; valueUsd: null; vaultBalance: string; explorerUrl: string }>;
  methodology: string;
}

export async function readAttributionSnapshot(tokenAddress: string, vaultAddress: string, walletAddress: string, excluded: string[], tokenSymbol: string): Promise<AttributionSnapshot> {
  const [chainHex, blockHex] = await Promise.all([rpc("eth_chainId", []), rpc("eth_blockNumber", [])]);
  if (typeof chainHex !== "string" || !UINT_HEX.test(chainHex) || BigInt(chainHex) !== BigInt(ROBINHOOD_CHAIN.id)) throw new Error("Unexpected RPC chain");
  if (typeof blockHex !== "string" || !UINT_HEX.test(blockHex)) throw new Error("Invalid RPC block number");
  const block = Number(BigInt(blockHex));
  if (!Number.isSafeInteger(block)) throw new Error("Invalid RPC block number");

  const calls = [
    { to: tokenAddress, data: TOTAL_SUPPLY },
    { to: tokenAddress, data: DECIMALS },
    { to: tokenAddress, data: balanceOfData(walletAddress) },
    ...excluded.map((address) => ({ to: tokenAddress, data: balanceOfData(address) })),
    ...STOCK_ASSETS.flatMap((asset) => [
      { to: asset.address, data: balanceOfData(vaultAddress) },
      { to: asset.address, data: DECIMALS },
    ]),
  ];
  const values = await rpcBatch(calls, blockHex);
  const totalSupply = values[0];
  const tokenDecimals = Number(values[1]);
  const walletBalance = excluded.some((address) => address.toLowerCase() === walletAddress.toLowerCase()) ? 0n : values[2];
  if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 36) throw new Error("Invalid token decimals");
  const excludedBalance = values.slice(3, 3 + excluded.length).reduce((sum, value) => sum + value, 0n);
  assertValidSnapshot(totalSupply, excludedBalance, walletBalance);
  const eligibleSupply = totalSupply - excludedBalance;
  const offset = 3 + excluded.length;
  const allocations = STOCK_ASSETS.flatMap((asset, index) => {
    const vaultBalance = values[offset + index * 2];
    const decimals = Number(values[offset + index * 2 + 1]);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error("Invalid vault asset decimals");
    if (vaultBalance <= 0n) return [];
    const allocated = proRataAllocation(vaultBalance, walletBalance, eligibleSupply);
    if (allocated > vaultBalance) throw new Error("Allocation exceeds vault balance");
    return [{
      address: asset.address,
      symbol: asset.symbol,
      name: asset.name,
      amount: formatUnits(allocated, decimals, 8),
      rawAmount: allocated.toString(),
      valueUsd: null,
      vaultBalance: formatUnits(vaultBalance, decimals, 6),
      explorerUrl: `${ROBINHOOD_CHAIN.explorer}/token/${asset.address}?tab=token_holders`,
    }];
  });
  return {
    blockNumber: block,
    tokenSymbol: tokenSymbol.slice(0, 20),
    tokenAddress,
    vaultAddress,
    walletBalance: formatUnits(walletBalance, tokenDecimals, 6),
    eligibleSupply: formatUnits(eligibleSupply, tokenDecimals, 6),
    sharePercent: sharePercent(walletBalance, eligibleSupply),
    allocations,
    methodology: "single-block RPC snapshot: wallet eligible balance ÷ eligible supply × each allowlisted vault asset balance",
  };
}
