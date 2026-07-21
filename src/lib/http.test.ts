import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedJson } from "./http.ts";

test("bounded JSON reader accepts a small valid payload", async () => {
  const value = await readBoundedJson(new Response('{"ok":true}', { headers: { "content-length": "11" } }), 32);
  assert.deepEqual(value, { ok: true });
});

test("bounded JSON reader rejects an oversized chunked body before full buffering", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(8));
      controller.enqueue(new Uint8Array(8));
      controller.enqueue(new Uint8Array(8));
    },
    cancel() { cancelled = true; },
  });
  await assert.rejects(() => readBoundedJson(new Response(body), 16), /too large/i);
  assert.equal(cancelled, true);
});

test("bounded JSON reader rejects dishonest or malformed content lengths", async () => {
  await assert.rejects(() => readBoundedJson(new Response("{}", { headers: { "content-length": "999" } }), 16), /too large/i);
  await assert.rejects(() => readBoundedJson(new Response("{}", { headers: { "content-length": "garbage" } }), 16), /content-length/i);
});
