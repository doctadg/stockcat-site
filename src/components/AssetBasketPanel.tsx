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
        <span className="sectionIndex light">03 / WHAT THE CAT TRADES</span>
        <h2>THE CAT<br /><em>TRADES THESE.</em></h2>
        <p>Stockcat trades a public basket of Robinhood Stock Tokens. Trading profit goes to the vault. Holders share the vault by how much $STOCKCAT they own.</p>
        <div className="mechanicFlow"><span><b>01</b> CAT TRADES</span><i>→</i><span><b>02</b> PROFIT TO VAULT</span><i>→</i><span><b>03</b> HOLDERS SHARE</span></div>
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
      <div className="basketTruth panelReveal"><b>{dependency === "available" ? "LIVE REFERENCES · CHAIN 4663" : dependency === "partial" ? "PARTIAL EXPLORER DATA" : dependency === "unavailable" ? "EXPLORER UNAVAILABLE" : "CHECKING CHAIN 4663"}</b><span>Pre-launch target basket—not current holdings. Activation requires the live token, vault, and executor.</span></div>
    </>
  );
}
