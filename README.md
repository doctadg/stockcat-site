# Stockcat

A nine-panel horizontal campaign site for **$STOCKCAT**: one cat, every job, with a public image library and a read-only Robinhood Chain portfolio terminal.

## What is live

- Full horizontal wheel, touch, and keyboard navigation
- Seven-file campaign image library with direct originals
- Live Robinhood Stock Token market shelf using Blockscout data
- Wallet lookup for native ETH and ERC-20 assets on Robinhood Chain (chain ID `4663`)
- Stock Tokens surfaced first with explorer links and current Blockscout prices
- Deterministic holder attribution for assets held by a configured buyback vault
- Honest pre-launch state when the Stockcat token and vault do not exist yet

The browser never requests a signature, wallet connection, private key, or transaction approval.

## Portfolio APIs

### `GET /api/market`

Reads the six configured stock contracts from Robinhood Chain Blockscout. No sample prices or balances are substituted when the explorer is unavailable.

### `GET /api/portfolio?address=0x…`

Validates an EVM address, then reads:

- native ETH balance;
- all indexed ERC-20 balances;
- known Robinhood Stock Tokens;
- holder-attributed buyback vault balances when launch contracts are configured.

The endpoint is read-only, rate-limited per runtime instance, coalesces identical in-flight reads, and keeps a 15-second private server cache. Blockscout payloads are size-bounded and runtime-validated before use.

## Activating holder attribution

Set these server-side environment variables after deploying and verifying the production contracts:

```bash
STOCKCAT_TOKEN_ADDRESS=0x...
STOCKCAT_BUYBACK_VAULT_ADDRESS=0x...
STOCKCAT_EXCLUDED_ADDRESSES=0xLiquidityPool...,0xDeadAddress...
STOCKCAT_ATTRIBUTION_ENABLED=true
STOCKCAT_TOKEN_SYMBOL=$STOCKCAT
```

The vault is always excluded automatically. Additional comma-separated addresses should include every balance that is not entitled to vault assets, such as liquidity custody, locked protocol allocations, bridges, and burn addresses.

Attribution remains disabled unless the explicit enable flag is set. When enabled, supply, holder balances, exclusions, and allowlisted vault assets are read from RPC at one pinned block. Impossible snapshots fail closed. The displayed allocation uses exact integer arithmetic:

```text
eligible supply = total supply − excluded balances
wallet share    = wallet eligible balance ÷ eligible supply
asset share     = vault asset balance × wallet eligible balance ÷ eligible supply
```

No price estimate participates in the ownership calculation. Prices are presentation-only.

## Buyback execution boundary

The site **reads** the resulting vault. It does not hold an executor key or submit stock purchases. The fee collector and buyback worker must remain a separate, authenticated service with:

1. per-cycle fee budgets;
2. an idempotency key before every swap;
3. quote expiry, slippage, and liquidity limits;
4. an allowlist of verified Robinhood Stock Token contracts;
5. on-chain receipt reconciliation before updating cycle state;
6. a dedicated vault that cannot be confused with the executor wallet.

Until those contracts and the executor are deployed, the interface shows `PENDING LAUNCH` rather than fabricated holdings.

## Development

```bash
source ~/.nvm/nvm.sh && nvm use 22
npm install
npm test
npm run lint
npm run build
npm run dev
```

## Canonical chain references

- Robinhood Chain: `4663` (`0x1237`)
- Explorer: <https://robinhoodchain.blockscout.com>
- RPC: <https://rpc.mainnet.chain.robinhood.com>
