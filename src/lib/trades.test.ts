import test from "node:test";
import assert from "node:assert/strict";
import { fetchActiveTradeResponse, parseActiveTradesPayload, parseTradeTapePayload } from "./trades.ts";

const wallet = "0x9f736F87E6293AC1Bd9142E257dbfAC8b7AcF1ae";
const token = "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC";
const tx = `0x${"a".repeat(64)}`;

function row(overrides: Record<string, unknown> = {}) {
  return {
    from: { hash: wallet },
    to: { hash: "0xf4da3c42D9c9F494d4688A0112a9DB3C9b18a914" },
    method: "swap",
    timestamp: "2026-07-21T13:06:59.000000Z",
    transaction_hash: tx,
    log_index: 7,
    token: { address_hash: token, symbol: "NVDA", name: "NVIDIA", exchange_rate: "214.53" },
    total: { decimals: "18", value: "1125967218526969947" },
    ...overrides,
  };
}

test("active trade parser returns bounded verified stock swaps", () => {
  const trades = parseActiveTradesPayload({ items: [
    row(),
    row({ from: { hash: "0x1d4B86491ec211257cbedD77A4380a7494624EfF" }, to: { hash: wallet }, transaction_hash: `0x${"b".repeat(64)}`, log_index: 8 }),
  ] }, wallet, [{ address: token, symbol: "NVDA", name: "NVIDIA" }]);

  assert.equal(trades.length, 2);
  assert.deepEqual(trades.map((trade) => trade.side), ["SELL", "BUY"]);
  assert.equal(trades[0].symbol, "NVDA");
  assert.equal(trades[0].amount, "1.1259");
  assert.equal(trades[0].priceUsd, 214.53);
  assert.equal(trades[0].estimatedValueUsd, 241.55);
});

test("active trade parser ignores non-swap and non-allowlisted transfers", () => {
  const trades = parseActiveTradesPayload({ items: [
    row({ method: "transfer" }),
    row({ token: { address_hash: "0x1111111111111111111111111111111111111111", symbol: "FAKE", name: "Fake", exchange_rate: "1" } }),
  ] }, wallet, [{ address: token, symbol: "NVDA", name: "NVIDIA" }]);
  assert.deepEqual(trades, []);
});

test("active trade parser fails closed on malformed rows and oversized payloads", () => {
  assert.throws(() => parseActiveTradesPayload({ items: [row({ transaction_hash: "bad" })] }, wallet, [{ address: token, symbol: "NVDA", name: "NVIDIA" }]), /Invalid trade row/);
  assert.throws(() => parseActiveTradesPayload({ items: [{}] }, wallet, [{ address: token, symbol: "NVDA", name: "NVIDIA" }]), /Invalid trade row/);
  assert.throws(() => parseActiveTradesPayload({ items: [row({ token: {} })] }, wallet, [{ address: token, symbol: "NVDA", name: "NVIDIA" }]), /Invalid trade row/);
  assert.throws(() => parseActiveTradesPayload({ items: Array.from({ length: 101 }, () => row()) }, wallet, [{ address: token, symbol: "NVDA", name: "NVIDIA" }]), /Too many trade rows/);
});

test("active trade parser rejects a wallet not involved in the transfer", () => {
  assert.throws(() => parseActiveTradesPayload({ items: [row({ from: { hash: "0x1111111111111111111111111111111111111111" } })] }, wallet, [{ address: token, symbol: "NVDA", name: "NVIDIA" }]), /Invalid trade row/);
});

test("active trade fetch retries transient explorer failures", async () => {
  let attempts = 0;
  const fakeFetch = async () => {
    attempts += 1;
    if (attempts < 3) throw new DOMException("timed out", "TimeoutError");
    return new Response("{}", { status: 200 });
  };
  const response = await fetchActiveTradeResponse("https://example.com/trades", fakeFetch, 3, 1);
  assert.equal(response.status, 200);
  assert.equal(attempts, 3);
});

test("active trade fetch does not retry permanent HTTP failures", async () => {
  let attempts = 0;
  const fakeFetch = async () => { attempts += 1; return new Response("no", { status: 404 }); };
  await assert.rejects(fetchActiveTradeResponse("https://example.com/trades", fakeFetch, 3, 1), /Explorer HTTP 404/);
  assert.equal(attempts, 1);
});

test("trade tape payload parser rejects rate limits and malformed shapes", () => {
  assert.throws(() => parseTradeTapePayload({ error: "Too many trade reads.", code: "RATE_LIMITED" }), /Invalid trade tape/);
  assert.throws(() => parseTradeTapePayload({ status: "available", wallet: {}, trades: [] }), /Invalid trade tape/);
});
