import { NextResponse } from "next/server";
import { ROBINHOOD_CHAIN, STOCK_ASSETS, type BlockscoutToken } from "@/lib/robinhood";

export const dynamic = "force-dynamic";

async function fetchToken(address: string): Promise<BlockscoutToken> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${ROBINHOOD_CHAIN.explorer}/api/v2/tokens/${address}`, {
      headers: { "User-Agent": "Stockcat/1.0" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8_000),
    });
    if (response.ok) return response.json();
    lastStatus = response.status;
    if (response.status < 500 && response.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
  }
  throw new Error(`Explorer returned ${lastStatus}`);
}

export async function GET() {
  const settled = await Promise.allSettled(STOCK_ASSETS.map(async (asset) => ({ asset, token: await fetchToken(asset.address) })));
  const assets = settled.flatMap((entry) => {
    if (entry.status !== "fulfilled") return [];
    const { asset, token } = entry.value;
    return [{
      ...asset,
      priceUsd: token.exchange_rate ? Number(token.exchange_rate) : null,
      holders: token.holders_count ? Number(token.holders_count) : null,
      volume24hUsd: token.volume_24h ? Number(token.volume_24h) : null,
      iconUrl: token.icon_url,
      explorerUrl: `${ROBINHOOD_CHAIN.explorer}/token/${asset.address}`,
    }];
  });

  return NextResponse.json({
    chain: { id: ROBINHOOD_CHAIN.id, name: ROBINHOOD_CHAIN.name },
    assets,
    partial: assets.length !== STOCK_ASSETS.length,
    observedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
