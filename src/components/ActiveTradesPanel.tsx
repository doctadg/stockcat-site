"use client";

import { useEffect, useState } from "react";
import { parseTradeTapePayload, type TradeTapePayload } from "@/lib/trades";

function short(value: string) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }
function dollars(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}
function when(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function ActiveTradesPanel() {
  const [tape, setTape] = useState<TradeTapePayload | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => fetch("/api/trades", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error("Trade tape unavailable");
        return parseTradeTapePayload(data);
      })
      .then((data) => { setTape(data); setUnavailable(false); })
      .catch((error) => { if (error.name !== "AbortError") { setTape(null); setUnavailable(true); } });
    load();
    const id = window.setInterval(load, 15_000);
    return () => { controller.abort(); window.clearInterval(id); };
  }, []);

  const official = tape?.wallet.mode === "official";
  return (
    <>
      <div className="tradesIntro panelReveal">
        <span className="sectionIndex light">04 / ACTIVE TRADE TAPE</span>
        <h2>WATCH THE<br /><em>CAT WORK.</em></h2>
        <p>{official ? "Live swaps from the configured Stockcat trading wallet." : "A live Stock Token swap tape from a high-activity public Robinhood Chain wallet. This proves the trading rails—not project ownership."}</p>
        <a className="tradeWallet" href={tape?.wallet.explorerUrl ?? "https://robinhoodchain.blockscout.com"} target="_blank" rel="noreferrer">
          <span>{official ? "STOCKCAT WALLET" : "REFERENCE WALLET"}</span>
          <b>{tape?.wallet.address ? short(tape.wallet.address) : "SYNCING…"}</b>
          <small>{official ? "PROJECT CONFIGURED" : "PUBLIC · NOT STOCKCAT-OWNED"} ↗</small>
        </a>
        <div className="tradeRail"><span><i /> LIVE CHAIN</span><b>ROBINHOOD · 4663</b></div>
      </div>

      <div className="tradeTape panelReveal">
        <div className="tapeBar"><span>RECENT VERIFIED STOCK TOKEN SWAPS · EST. USD @ CURRENT PRICE</span><b>{unavailable ? "UNAVAILABLE" : tape?.status === "available" ? "STREAMING" : tape?.status === "empty" ? "NO RECENT SWAPS" : "SYNCING"}</b></div>
        <div className="tradeRows">
          {tape?.trades.length ? tape.trades.slice(0, 8).map((trade) => (
            <a href={trade.explorerUrl} target="_blank" rel="noreferrer" className={`tradeRow ${trade.side.toLowerCase()}`} key={`${trade.txHash}:${trade.logIndex}`}>
              <span className="tradeSide">{trade.side}</span>
              <b>{trade.symbol}</b>
              <span className="tradeAmount">{trade.amount}</span>
              <strong>~{dollars(trade.estimatedValueUsd)}</strong>
              <time dateTime={trade.timestamp}>{when(trade.timestamp)}</time>
              <i>↗</i>
            </a>
          )) : unavailable ? <div className="tradeUnavailable"><b>LIVE TRADE DATA UNAVAILABLE</b><span>Blockscout did not return a trustworthy trade tape. The site will retry automatically.</span></div> : tape?.status === "empty" ? <div className="tradeUnavailable"><b>NO RECENT VERIFIED SWAPS</b><span>The wallet has no allowlisted Stock Token swaps in the latest explorer window.</span></div> : Array.from({ length: 6 }, (_, index) => <div className="tradeSkeleton" key={index}><i /><i /><i /><i /></div>)}
        </div>
        <div className="tapeFoot"><span>{unavailable ? "BLOCKSCOUT · DATA UNAVAILABLE" : "BLOCKSCOUT · LIVE PUBLIC DATA"}</span><span>{tape?.disclaimer ?? (unavailable ? "NO LIVE CLAIM IS BEING MADE" : "READ-ONLY CHAIN FEED")}</span></div>
      </div>
    </>
  );
}
