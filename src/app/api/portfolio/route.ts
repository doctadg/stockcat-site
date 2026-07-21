import { NextRequest, NextResponse } from "next/server";
import {
  ROBINHOOD_CHAIN,
  STOCK_ASSETS,
  formatUnits,
  isEvmAddress,
  proRataAllocation,
  sharePercent,
  tokenAddress,
  type BlockscoutBalance,
  type BlockscoutToken,
} from "@/lib/robinhood";

export const dynamic = "force-dynamic";

const EXPLORER = ROBINHOOD_CHAIN.explorer;

async function explorerJson<T>(path: string): Promise<T> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${EXPLORER}${path}`, {
      headers: { "User-Agent": "Stockcat/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return response.json();
    lastStatus = response.status;
    if (response.status < 500 && response.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw new Error(`Robinhood Chain explorer returned ${lastStatus}`);
}

async function balances(address: string): Promise<BlockscoutBalance[]> {
  return explorerJson<BlockscoutBalance[]>(`/api/v2/addresses/${address}/token-balances`);
}

function findBalance(rows: BlockscoutBalance[], address: string): BlockscoutBalance | undefined {
  const needle = address.toLowerCase();
  return rows.find((row) => tokenAddress(row.token) === needle);
}

function publicAsset(row: BlockscoutBalance) {
  const decimals = Number(row.token.decimals ?? 18);
  const amount = formatUnits(row.value, decimals, 6);
  const price = row.token.exchange_rate ? Number(row.token.exchange_rate) : null;
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
    valueUsd: price === null ? null : Number(amount) * price,
    explorerUrl: `${EXPLORER}/token/${row.token.address_hash}`,
  };
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!isEvmAddress(address)) {
    return NextResponse.json({ error: "Enter a valid 0x wallet address.", code: "INVALID_ADDRESS" }, { status: 400 });
  }

  try {
    const [walletRows, account] = await Promise.all([
      balances(address),
      explorerJson<{ coin_balance: string; exchange_rate: string | null; is_contract: boolean; block_number_balance_updated_at: number }>(`/api/v2/addresses/${address}`),
    ]);

    const allWalletAssets = walletRows
      .filter((row) => BigInt(row.value || "0") > 0n)
      .map(publicAsset)
      .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
    const stockRegistry = new Set(STOCK_ASSETS.map((asset) => asset.address.toLowerCase()));
    const stockAssets = allWalletAssets.filter((asset) => stockRegistry.has(asset.address.toLowerCase()));
    const walletAssets = allWalletAssets.slice(0, 100);

    const tokenContract = process.env.STOCKCAT_TOKEN_ADDRESS?.trim();
    const vaultAddress = process.env.STOCKCAT_BUYBACK_VAULT_ADDRESS?.trim();
    const configured = Boolean(tokenContract && vaultAddress && isEvmAddress(tokenContract!) && isEvmAddress(vaultAddress!));

    let holderShare = null;
    if (configured) {
      const excluded = Array.from(new Map([
        vaultAddress!,
        ...(process.env.STOCKCAT_EXCLUDED_ADDRESSES ?? "").split(",").map((item) => item.trim()).filter(isEvmAddress),
      ].map((item) => [item.toLowerCase(), item])).values());
      const otherExcluded = excluded.filter((item) => item.toLowerCase() !== vaultAddress!.toLowerCase());
      const [tokenMeta, vaultRows, ...excludedRows] = await Promise.all([
        explorerJson<BlockscoutToken>(`/api/v2/tokens/${tokenContract}`),
        balances(vaultAddress!),
        ...otherExcluded.map((item) => balances(item)),
      ]);
      const walletCoin = findBalance(walletRows, tokenContract!);
      const walletIsExcluded = excluded.some((item) => item.toLowerCase() === address.toLowerCase());
      const totalSupply = BigInt(tokenMeta.total_supply ?? "0");
      const excludedBalance = BigInt(findBalance(vaultRows, tokenContract!)?.value ?? "0")
        + excludedRows.reduce((sum, rows) => sum + BigInt(findBalance(rows, tokenContract!)?.value ?? "0"), 0n);
      const eligibleSupply = totalSupply > excludedBalance ? totalSupply - excludedBalance : 0n;
      const walletBalance = walletIsExcluded ? 0n : BigInt(walletCoin?.value ?? "0");
      const allocations = STOCK_ASSETS.flatMap((asset) => {
        const row = findBalance(vaultRows, asset.address);
        if (!row || BigInt(row.value || "0") === 0n) return [];
        const allocatedRaw = proRataAllocation(row.value, walletBalance, eligibleSupply);
        const decimals = Number(row.token.decimals ?? 18);
        const amount = formatUnits(allocatedRaw, decimals, 8);
        const price = row.token.exchange_rate ? Number(row.token.exchange_rate) : null;
        return [{
          symbol: row.token.symbol,
          name: row.token.name,
          address: row.token.address_hash,
          amount,
          rawAmount: allocatedRaw.toString(),
          valueUsd: price === null ? null : Number(amount) * price,
          vaultBalance: formatUnits(row.value, decimals, 6),
          explorerUrl: `${EXPLORER}/token/${row.token.address_hash}?tab=token_holders`,
        }];
      });
      holderShare = {
        tokenAddress: tokenContract,
        vaultAddress,
        tokenSymbol: tokenMeta.symbol,
        walletBalance: formatUnits(walletBalance, Number(tokenMeta.decimals ?? 18), 6),
        eligibleSupply: formatUnits(eligibleSupply, Number(tokenMeta.decimals ?? 18), 6),
        sharePercent: sharePercent(walletBalance, eligibleSupply),
        allocations,
        methodology: "wallet eligible token balance ÷ eligible holder supply × each verified vault asset balance",
      };
    }

    const eth = formatUnits(account.coin_balance || "0", 18, 6);
    return NextResponse.json({
      address,
      chain: { id: ROBINHOOD_CHAIN.id, name: ROBINHOOD_CHAIN.name, explorer: EXPLORER },
      blockNumber: account.block_number_balance_updated_at,
      nativeBalance: { symbol: "ETH", amount: eth, valueUsd: account.exchange_rate ? Number(eth) * Number(account.exchange_rate) : null },
      walletAssets,
      stockAssets,
      buyback: configured ? { status: "live", holderShare } : {
        status: "awaiting-deployment",
        holderShare: null,
        reason: "$STOCKCAT token and its dedicated buyback vault are not deployed/configured yet.",
      },
      observedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: "Robinhood Chain data is temporarily unavailable.",
      code: "UPSTREAM_UNAVAILABLE",
      detail: error instanceof Error ? error.message : "Unknown upstream error",
    }, { status: 502 });
  }
}
