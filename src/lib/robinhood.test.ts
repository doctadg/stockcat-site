import test from "node:test";
import assert from "node:assert/strict";
import { STOCK_ASSETS, formatUnits, isEvmAddress, proRataAllocation, sharePercent } from "./robinhood.ts";

test("canonical stock basket is complete, unique, and totals 100%", () => {
  assert.equal(STOCK_ASSETS.reduce((sum, asset) => sum + asset.weight, 0), 100);
  assert.equal(new Set(STOCK_ASSETS.map((asset) => asset.address.toLowerCase())).size, STOCK_ASSETS.length);
  for (const asset of STOCK_ASSETS) assert.equal(isEvmAddress(asset.address), true, `${asset.symbol} address`);
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
