import { test } from "node:test";
import assert from "node:assert/strict";

import { latestOnlyQueue } from "./latest-only-queue.ts";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("never two saves at once; while one runs only the latest change is kept", async () => {
  const started: number[] = [];
  let active = 0;
  let maxActive = 0;
  const releases: (() => void)[] = [];
  const q = latestOnlyQueue<number>((n) => {
    started.push(n);
    active++;
    maxActive = Math.max(maxActive, active);
    return new Promise<void>((res) => releases.push(() => { active--; res(); }));
  });
  q.push(1);
  q.push(2);
  q.push(3); // replaces 2: stale
  await tick();
  assert.deepEqual(started, [1]);
  releases.shift()!();
  await tick();
  await tick();
  assert.deepEqual(started, [1, 3]);
  releases.shift()!();
  await q.idle();
  assert.equal(maxActive, 1);
});

test("idle() waits for the queued save too, so closing uses the latest count", async () => {
  const done: number[] = [];
  const q = latestOnlyQueue<number>(async (n) => {
    await tick();
    done.push(n);
  });
  q.push(1);
  q.push(2);
  await q.idle();
  assert.deepEqual(done, [1, 2]);
});

test("a failed save reports error and the next change still saves", async () => {
  const states: string[] = [];
  let fail = true;
  const q = latestOnlyQueue<number>(
    async () => {
      if (fail) { fail = false; throw new Error("429"); }
    },
    (s) => states.push(s),
  );
  q.push(1);
  await q.idle();
  q.push(2);
  await q.idle();
  assert.deepEqual(states, ["saving", "error", "saving", "saved"]);
});
