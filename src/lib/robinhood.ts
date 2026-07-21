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

export const TRADE_ASSETS = [
  ...STOCK_ASSETS,
  { symbol: "AMD", name: "AMD", address: "0x86923f96303D656E4aa86D9d42D1e57ad2023fdC" },
  { symbol: "CRCL", name: "Circle Internet Group", address: "0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5" },
  { symbol: "MU", name: "Micron Technology", address: "0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD" },
  { symbol: "NFLX", name: "Netflix", address: "0xE0444EF8BF4eD74f74FD73686e2ddF4C1c5591E8" },
  { symbol: "SNDK", name: "Sandisk Corporation", address: "0xB90A19fF0Af67f7779afF50A882A9CfF42446400" },
  { symbol: "USO", name: "United States Oil Fund", address: "0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344" },
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

const NON_NEGATIVE_INTEGER = /^\d{1,96}$/;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function boundedText(value: unknown, max = 80): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

function finiteRate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > 48) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? value : null;
}

export function safeProduct(left: number | null, right: number | null): number | null {
  if (left === null || right === null) return null;
  const product = left * right;
  return Number.isFinite(product) && product >= 0 ? product : null;
}

export function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function parseTokenBalancePayload(input: unknown, maxRows = 200): { rows: BlockscoutBalance[]; rejected: number; inputCount: number } {
  if (!Array.isArray(input)) throw new Error("Invalid token balance response");
  if (input.length > maxRows) throw new Error("Too many token balance rows");
  const unique = new Map<string, BlockscoutBalance>();
  let rejected = 0;
  for (const candidate of input) {
    const row = record(candidate);
    const token = record(row?.token);
    const address = boundedText(token?.address_hash, 42);
    const decimalsText = token?.decimals;
    const decimals = typeof decimalsText === "string" && /^\d{1,2}$/.test(decimalsText) ? Number(decimalsText) : NaN;
    const value = row?.value;
    const name = boundedText(token?.name);
    const symbol = boundedText(token?.symbol);
    const tokenType = token?.type;
    if (tokenType !== "ERC-20") {
      if (tokenType === "ERC-721" || tokenType === "ERC-1155" || tokenType === "ERC-404") continue;
      rejected += 1;
      continue;
    }
    if (!address || !isEvmAddress(address) || !Number.isInteger(decimals) || decimals < 0 || decimals > 36 || !name || !symbol || typeof value !== "string" || !NON_NEGATIVE_INTEGER.test(value)) { rejected += 1; continue; }
    const totalSupply = token?.total_supply;
    if (totalSupply !== null && totalSupply !== undefined && (typeof totalSupply !== "string" || !NON_NEGATIVE_INTEGER.test(totalSupply))) { rejected += 1; continue; }
    const icon = token?.icon_url;
    const parsed: BlockscoutBalance = {
      value,
      token: {
        address_hash: address,
        decimals: String(decimals),
        exchange_rate: finiteRate(token?.exchange_rate),
        icon_url: typeof icon === "string" && icon.length <= 500 && /^https:\/\//i.test(icon) ? icon : null,
        name,
        symbol,
        total_supply: typeof totalSupply === "string" ? totalSupply : null,
        type: "ERC-20",
        volume_24h: finiteRate(token?.volume_24h),
        holders_count: typeof token?.holders_count === "string" && NON_NEGATIVE_INTEGER.test(token.holders_count) ? token.holders_count : null,
      },
    };
    const key = address.toLowerCase();
    if (!unique.has(key)) unique.set(key, parsed);
  }
  return { rows: [...unique.values()], rejected, inputCount: input.length };
}

export function parseTokenBalanceRows(input: unknown, maxRows = 200): BlockscoutBalance[] {
  return parseTokenBalancePayload(input, maxRows).rows;
}

export function normalizeExcludedAddresses(addresses: string[], max = 20): string[] {
  const unique = new Set<string>();
  for (const address of addresses) {
    const normalized = address.trim().toLowerCase();
    if (!isEvmAddress(normalized)) throw new Error("Invalid excluded address");
    unique.add(normalized);
  }
  if (unique.size > max) throw new Error("Too many excluded addresses");
  return [...unique];
}

export function assertValidSnapshot(totalSupply: bigint, excludedBalance: bigint, walletBalance: bigint): void {
  if (totalSupply <= 0n) throw new Error("Total supply must be positive");
  if (excludedBalance < 0n || excludedBalance >= totalSupply) throw new Error("Excluded balance must be below total supply");
  const eligibleSupply = totalSupply - excludedBalance;
  if (walletBalance < 0n || walletBalance > eligibleSupply) throw new Error("Wallet balance exceeds eligible supply");
}

export function formatUnits(raw: string | bigint, decimals: number, maxFraction = 4): string {
  const safeDecimals = Number.isInteger(decimals) ? Math.min(36, Math.max(0, decimals)) : 18;
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
  if (wallet > supply) throw new Error("Wallet balance exceeds eligible supply");
  return (vault * wallet) / supply;
}

export function sharePercent(walletBalance: string | bigint, eligibleSupply: string | bigint): number {
  const wallet = BigInt(walletBalance);
  const supply = BigInt(eligibleSupply);
  if (wallet <= 0n || supply <= 0n) return 0;
  if (wallet > supply) throw new Error("Wallet balance exceeds eligible supply");
  const partsPerBillion = (wallet * 1_000_000_000n) / supply;
  return Number(partsPerBillion) / 10_000_000;
}

export function tokenAddress(token: BlockscoutToken): string {
  return token.address_hash.toLowerCase();
}
