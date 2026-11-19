import { test } from "node:test";
import assert from "node:assert/strict";

import { createSubmitGuard } from "./submit.ts";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("a second run while the first is pending is skipped and fn is not called", async () => {
  const guard = createSubmitGuard();
  const d = deferred<number>();
  let calls = 0;
  const fn = () => {
    calls++;
    return d.promise;
  };
  const first = guard.run(fn);
  assert.deepEqual(await guard.run(fn), { status: "skipped" });
  assert.equal(calls, 1);
  d.resolve(1);
  assert.deepEqual(await first, { status: "ok", value: 1 });
});

test("busy is true while pending and false after it settles", async () => {
  const guard = createSubmitGuard();
  const d = deferred<void>();
  assert.equal(guard.busy, false);
  const p = guard.run(() => d.promise);
  assert.equal(guard.busy, true);
  d.resolve();
  await p;
  assert.equal(guard.busy, false);
});

test("a rejected fn returns status error and releases the guard", async () => {
  const guard = createSubmitGuard();
  const boom = new Error("boom");
  const r = await guard.run(() => Promise.reject(boom));
  assert.deepEqual(r, { status: "error", error: boom });
  let calls = 0;
  const r2 = await guard.run(async () => {
    calls++;
    return "x";
  });
  assert.equal(calls, 1);
  assert.deepEqual(r2, { status: "ok", value: "x" });
});
