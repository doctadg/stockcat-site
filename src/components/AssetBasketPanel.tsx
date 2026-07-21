"use client";

import { useEffect, useState } from "react";
import { STOCK_ASSETS } from "@/lib/robinhood";

type MarketAsset = (typeof STOCK_ASSETS)[number] & {
  status: "available" | "unavailable";
  priceUsd: number | null;
  holders: number | null;
  volume24hUsd: number | null;
  explorerUrl: string;
};

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "SYNCING";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value < 10 ? 2 : 0 }).format(value);
}

export function AssetBasketPanel() {
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [dependency, setDependency] = useState<"loading" | "available" | "partial" | "unavailable">("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/market", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("market unavailable")))
      .then((data) => { setAssets(data.assets ?? []); setDependency(data.status ?? "unavailable"); })
      .catch((error) => { if (error.name !== "AbortError") setDependency("unavailable"); });
    return () => controller.abort();
  }, []);

  const live = new Map(assets.map((asset) => [asset.symbol, asset]));
  return (
    <>
      <div className="basketIntro panelReveal">
        <span className="sectionIndex light">04 / THE STOCK SHELF</span>
        <h2>FEES AIM<br /><em>AT THE REAL WORLD.</em></h2>
        <p>The planned basket uses verified Robinhood Stock Token contracts. Once the coin and vault launch, fee-funded execution can acquire these assets through live on-chain markets.</p>
        <div className="mechanicFlow"><span><b>01</b> PLANNED FEES</span><i>→</i><span><b>02</b> EXECUTOR</span><i>→</i><span><b>03</b> VAULT ATTRIBUTION</span></div>
      </div>
      <div className="assetShelf panelReveal">
        {STOCK_ASSETS.map((asset) => {
          const current = live.get(asset.symbol);
          return <a href={current?.explorerUrl ?? `https://robinhoodchain.blockscout.com/token/${asset.address}`} target="_blank" rel="noreferrer" className="assetTile" key={asset.symbol} style={{ "--asset-color": asset.color } as React.CSSProperties}>
            <span className="assetWeight">{asset.weight}% TARGET</span>
            <b>{asset.symbol}</b>
            <strong>{money(current?.priceUsd ?? null)}</strong>
            <span>{asset.name}</span>
            <small>{current?.status === "available" && current.holders ? `${current.holders.toLocaleString()} HOLDERS` : current?.status === "unavailable" || dependency === "unavailable" ? "EXPLORER OFFLINE" : "LIVE CHAIN SYNC"}</small>
            <i />
          </a>;
        })}
      </div>
      <div className="basketTruth panelReveal"><b>{dependency === "available" ? "LIVE REFERENCES · CHAIN 4663" : dependency === "partial" ? "PARTIAL EXPLORER DATA" : dependency === "unavailable" ? "EXPLORER UNAVAILABLE" : "CHECKING CHAIN 4663"}</b><span>Basket weights are launch configuration—not current holdings. Stock Tokens provide economic exposure; they are not direct shares in the underlying companies.</span></div>
    </>
  );
}
