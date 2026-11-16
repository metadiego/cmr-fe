import { test } from "node:test";
import assert from "node:assert/strict";

import { createConfirmQueue } from "./confirm-queue.ts";

test("one request becomes current and settle(true) resolves true", async () => {
  const q = createConfirmQueue();
  const p = q.request({ title: "A" });
  assert.equal(q.current()?.title, "A");
  q.settle(true);
  assert.equal(await p, true);
  assert.equal(q.current(), null);
});

test("a second request waits until the first settles", async () => {
  const q = createConfirmQueue();
  const p1 = q.request({ title: "A" });
  const p2 = q.request({ title: "B" });
  assert.equal(q.current()?.title, "A");
  q.settle(false);
  assert.equal(await p1, false);
  assert.equal(q.current()?.title, "B");
  q.settle(true);
  assert.equal(await p2, true);
});

test("settle with nothing pending is a no-op", () => {
  const q = createConfirmQueue();
  let calls = 0;
  q.subscribe(() => calls++);
  q.settle(true);
  assert.equal(q.current(), null);
  assert.equal(calls, 0);
});

test("cancelAll resolves current and queued requests with false", async () => {
  const q = createConfirmQueue();
  const p1 = q.request({ title: "A" });
  const p2 = q.request({ title: "B" });
  q.cancelAll();
  assert.equal(await p1, false);
  assert.equal(await p2, false);
  assert.equal(q.current(), null);
});

test("subscribers are notified on request and on settle, and can unsubscribe", () => {
  const q = createConfirmQueue();
  let calls = 0;
  const off = q.subscribe(() => calls++);
  void q.request({ title: "A" });
  assert.equal(calls, 1);
  q.settle(true);
  assert.equal(calls, 2);
  off();
  void q.request({ title: "B" });
  assert.equal(calls, 2);
});
