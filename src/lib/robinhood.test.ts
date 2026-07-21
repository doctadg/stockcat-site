import test from "node:test";
import assert from "node:assert/strict";
import {
  STOCK_ASSETS,
  TRADE_ASSETS,
  assertValidSnapshot,
  formatUnits,
  isEvmAddress,
  normalizeExcludedAddresses,
  parseTokenBalancePayload,
  parseTokenBalanceRows,
  proRataAllocation,
  safeProduct,
  sharePercent,
} from "./robinhood.ts";

test("canonical stock basket is complete, unique, and totals 100%", () => {
  assert.equal(STOCK_ASSETS.reduce((sum, asset) => sum + asset.weight, 0), 100);
  assert.equal(new Set(STOCK_ASSETS.map((asset) => asset.address.toLowerCase())).size, STOCK_ASSETS.length);
  for (const asset of STOCK_ASSETS) assert.equal(isEvmAddress(asset.address), true, `${asset.symbol} address`);
});

test("trade tape allowlist contains unique valid contracts", () => {
  assert.equal(new Set(TRADE_ASSETS.map((asset) => asset.address.toLowerCase())).size, TRADE_ASSETS.length);
  for (const asset of TRADE_ASSETS) assert.equal(isEvmAddress(asset.address), true, `${asset.symbol} address`);
});

test("wallet validation rejects malformed and non-EVM input", () => {
  assert.equal(isEvmAddress("0x0000000000000000000000000000000000000000"), true);
  assert.equal(isEvmAddress("0x1234"), false);
  assert.equal(isEvmAddress("not-a-wallet"), false);
  assert.equal(isEvmAddress("0xgg00000000000000000000000000000000000000"), false);
});

test("raw units format without floating-point precision loss", () => {
  assert.equal(formatUnits("1234567890123456789", 18, 6), "1.234567");
  assert.equal(formatUnits("1000000", 6, 4), "1");
  assert.equal(formatUnits("42", 0, 4), "42");
  assert.equal(formatUnits("1", 1_000_000_000, 4), "0");
});

test("vault allocation uses exact floor division", () => {
  assert.equal(proRataAllocation(1_000n, 25n, 100n), 250n);
  assert.equal(proRataAllocation(10n, 1n, 3n), 3n);
  assert.equal(proRataAllocation(1_000n, 25n, 0n), 0n);
});

test("share percent is deterministic and bounded for normal holder data", () => {
  assert.equal(sharePercent(25n, 100n), 25);
  assert.equal(sharePercent(1n, 3n), 33.3333333);
  assert.equal(sharePercent(0n, 100n), 0);
});

test("impossible attribution snapshots fail closed", () => {
  assert.throws(() => assertValidSnapshot(100n, 100n, 0n), /excluded balance/i);
  assert.throws(() => assertValidSnapshot(100n, 20n, 81n), /wallet balance/i);
  assert.doesNotThrow(() => assertValidSnapshot(100n, 20n, 80n));
});

test("excluded addresses normalize case, deduplicate, and stay bounded", () => {
  const a = "0x1111111111111111111111111111111111111111";
  const b = "0x2222222222222222222222222222222222222222";
  assert.deepEqual(normalizeExcludedAddresses([a, a.toUpperCase().replace("0X", "0x"), b]), [a, b]);
  assert.throws(() => normalizeExcludedAddresses(Array.from({ length: 21 }, (_, i) => `0x${i.toString(16).padStart(40, "0")}`)), /too many/i);
});

test("Blockscout token rows are bounded, validated, and deduplicated", () => {
  const address = "0x3333333333333333333333333333333333333333";
  const row = { token: { address_hash: address, decimals: "18", exchange_rate: "2.5", icon_url: null, name: "Token", symbol: "TOK", total_supply: "1000", type: "ERC-20" }, value: "42" };
  assert.equal(parseTokenBalanceRows([row, row]).length, 1);
  assert.deepEqual(parseTokenBalanceRows([{ ...row, value: "-1" }]), []);
  assert.deepEqual(parseTokenBalanceRows([{ ...row, token: { ...row.token, decimals: "1000000000" } }]), []);
  assert.deepEqual(parseTokenBalanceRows([{ ...row, token: { ...row.token, symbol: "X".repeat(81) } }]), []);
  assert.throws(() => parseTokenBalanceRows(Array.from({ length: 201 }, () => row)), /too many/i);
  const diagnostics = parseTokenBalancePayload([row, { ...row, value: "-1" }]);
  assert.equal(diagnostics.rows.length, 1);
  assert.equal(diagnostics.rejected, 1);
  assert.equal(diagnostics.inputCount, 2);
  const ignored = parseTokenBalancePayload([{ ...row, token: { ...row.token, type: "ERC-721" } }]);
  assert.equal(ignored.rows.length, 0);
  assert.equal(ignored.rejected, 0);
  const malformed = parseTokenBalancePayload([{}, { token: { type: "UNKNOWN" } }]);
  assert.equal(malformed.rows.length, 0);
  assert.equal(malformed.rejected, 2);
});

test("allocations never exceed their vault balance", () => {
  assert.equal(proRataAllocation(100n, 80n, 80n), 100n);
  assert.throws(() => proRataAllocation(100n, 81n, 80n), /wallet balance/i);
  assert.equal(sharePercent(80n, 80n), 100);
  assert.throws(() => sharePercent(81n, 80n), /wallet balance/i);
});

test("USD products never serialize non-finite numbers", () => {
  assert.equal(safeProduct(2, 3), 6);
  assert.equal(safeProduct(1e308, 1e308), null);
  assert.equal(safeProduct(null, 3), null);
});
