export const ROBINHOOD_CHAIN = {
  id: 4663,
  name: "Robinhood Chain",
  explorer: "https://robinhoodchain.blockscout.com",
  rpc: "https://rpc.mainnet.chain.robinhood.com",
} as const;

export const STOCK_ASSETS = [
  { symbol: "SPY", name: "S&P 500", address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", weight: 30, color: "#183bff" },
  { symbol: "NVDA", name: "NVIDIA", address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", weight: 20, color: "#76b900" },
  { symbol: "AAPL", name: "APPLE", address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", weight: 15, color: "#111111" },
  { symbol: "TSLA", name: "TESLA", address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d", weight: 15, color: "#e82127" },
  { symbol: "QQQ", name: "NASDAQ 100", address: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68", weight: 10, color: "#8b5cf6" },
  { symbol: "AMZN", name: "AMAZON", address: "0x12f190a9F9d7D37a250758b26824B97CE941bF54", weight: 10, color: "#ff9900" },
] as const;

export type StockAsset = (typeof STOCK_ASSETS)[number];

export interface BlockscoutToken {
  address_hash: string;
  decimals: string | null;
  exchange_rate: string | null;
  icon_url: string | null;
  name: string;
  symbol: string;
  total_supply: string | null;
  type: string;
  volume_24h?: string | null;
  holders_count?: string | null;
}

export interface BlockscoutBalance {
  token: BlockscoutToken;
  value: string;
  token_id?: string | null;
}

export function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function formatUnits(raw: string | bigint, decimals: number, maxFraction = 4): string {
  const safeDecimals = Number.isInteger(decimals) ? Math.min(255, Math.max(0, decimals)) : 18;
  const value = typeof raw === "bigint" ? raw : BigInt(raw || "0");
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(safeDecimals);
  const whole = absolute / base;
  if (maxFraction <= 0 || safeDecimals === 0) return `${negative ? "-" : ""}${whole}`;
  const remainder = absolute % base;
  const rawFraction = remainder.toString().padStart(safeDecimals, "0").slice(0, maxFraction);
  const fraction = rawFraction.replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function proRataAllocation(vaultBalance: string | bigint, walletBalance: string | bigint, eligibleSupply: string | bigint): bigint {
  const vault = BigInt(vaultBalance);
  const wallet = BigInt(walletBalance);
  const supply = BigInt(eligibleSupply);
  if (vault <= 0n || wallet <= 0n || supply <= 0n) return 0n;
  return (vault * wallet) / supply;
}

export function sharePercent(walletBalance: string | bigint, eligibleSupply: string | bigint): number {
  const wallet = BigInt(walletBalance);
  const supply = BigInt(eligibleSupply);
  if (wallet <= 0n || supply <= 0n) return 0;
  const partsPerBillion = (wallet * 1_000_000_000n) / supply;
  return Number(partsPerBillion) / 10_000_000;
}

export function tokenAddress(token: BlockscoutToken): string {
  return token.address_hash.toLowerCase();
}
