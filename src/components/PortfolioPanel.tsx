"use client";

import { FormEvent, useState } from "react";

type Asset = { address: string; symbol: string; name: string; amount: string; valueUsd: number | null; explorerUrl: string };
type Allocation = { address: string; symbol: string; name: string; amount: string; valueUsd: number | null; explorerUrl: string };
type Portfolio = {
  address: string;
  blockNumber: number | null;
  nativeBalance: { amount: string; valueUsd: number | null };
  walletAssets: Asset[];
  stockAssets: Asset[];
  buyback: { status: "live" | "awaiting-deployment"; reason?: string; holderShare: null | { tokenSymbol: string; walletBalance: string; eligibleSupply: string; sharePercent: number; allocations: Allocation[]; vaultAddress: string; methodology: string } };
  observedAt: string;
};

function usd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}
function short(address: string) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }

export function PortfolioPanel() {
  const [address, setAddress] = useState("");
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function inspect(event: FormEvent) {
    event.preventDefault();
    setError(""); setPortfolio(null); setLoading(true);
    try {
      const response = await fetch(`/api/portfolio?address=${encodeURIComponent(address.trim())}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not read wallet");
      setPortfolio(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not read wallet");
    } finally { setLoading(false); }
  }

  const stockAddresses = new Set(portfolio?.stockAssets.map((asset) => asset.address.toLowerCase()) ?? []);
  const visibleAssets = [
    ...(portfolio?.stockAssets ?? []),
    ...(portfolio?.walletAssets.filter((asset) => !stockAddresses.has(asset.address.toLowerCase())) ?? []),
  ].slice(0, 6);
  const share = portfolio?.buyback.holderShare;

  return (
    <>
      <div className="portfolioCopy panelReveal">
        <span className="sectionIndex">05 / WALLET X-RAY</span>
        <h2>PASTE IT.<br /><em>SEE THE BOOKS.</em></h2>
        <p>Read any wallet on Robinhood Chain. No connect button. No signature. No custody.</p>
        <form onSubmit={inspect} className="walletForm">
          <label htmlFor="wallet-address">ROBINHOOD CHAIN ADDRESS</label>
          <div><input id="wallet-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} /><button disabled={loading}>{loading ? "READING…" : "INSPECT →"}</button></div>
          {error && <span className="walletError" role="alert">{error}</span>}
        </form>
        <div className="readOnlySeal"><b>READ ONLY</b><span>Powered by live Blockscout data<br />Robinhood Chain · 4663</span></div>
      </div>

      <div className={`portfolioTerminal panelReveal ${portfolio ? "hasData" : ""}`}>
        <div className="terminalBar"><span>STOCKCAT / PORTFOLIO TERMINAL</span><span>{portfolio ? (portfolio.blockNumber ? `BLOCK ${portfolio.blockNumber.toLocaleString()}` : "LIVE READ") : "AWAITING ADDRESS"}</span></div>
        {!portfolio ? <div className="terminalEmpty"><span>0x</span><p>Paste a wallet to reveal its live Robinhood Chain assets and attributed share of the Stockcat vault.</p></div> : <>
          <div className="walletIdentity"><div><span>WALLET</span><b>{short(portfolio.address)}</b></div><div><span>NATIVE BALANCE</span><b>{portfolio.nativeBalance.amount} ETH</b><small>{usd(portfolio.nativeBalance.valueUsd)}</small></div></div>
          <div className="walletAssetList">
            <span className="listLabel">ASSETS ON ROBINHOOD CHAIN · STOCK TOKENS FIRST</span>
            {visibleAssets.length ? visibleAssets.map((asset) => <a href={asset.explorerUrl} target="_blank" rel="noreferrer" key={asset.address}><b>{asset.symbol}</b><span>{asset.amount}</span><strong>{usd(asset.valueUsd)}</strong></a>) : <div className="noAssets">NO ERC-20 ASSETS FOUND</div>}
          </div>
          <div className={`vaultShare ${share ? "live" : "pending"}`}>
            <div><span>YOUR BUYBACK VAULT SHARE</span><b>{share ? `${share.sharePercent.toFixed(6)}%` : "PENDING LAUNCH"}</b></div>
            {share ? <div className="allocationRows">{share.allocations.slice(0, 3).map((asset) => <a href={asset.explorerUrl} target="_blank" rel="noreferrer" key={asset.address}><b>{asset.symbol}</b><span>{asset.amount}</span><strong>{usd(asset.valueUsd)}</strong></a>)}</div> : <p>$STOCKCAT and its dedicated vault are not deployed yet. This activates from verified contracts—never sample balances.</p>}
          </div>
        </>}
        <div className="terminalFoot"><span>NO WALLET CONNECTION</span><span>NO SAMPLE DATA</span><span>EXPLORER VERIFIED</span></div>
      </div>
    </>
  );
}
