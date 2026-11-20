import { test } from "node:test"
import assert from "node:assert/strict"

import { createLimiter, datesToRefresh, dayKey, isCurrent, runLimited } from "./day-cache.ts"

test("datesToRefresh returns all visible dates when event has no date", () => {
  const visible = ["2026-11-01", "2026-11-02"]
  assert.deepEqual(datesToRefresh(["2026-11-01", undefined], visible), visible)
  assert.deepEqual(datesToRefresh([undefined], visible), visible)
})

test("datesToRefresh returns only the intersection otherwise", () => {
  const visible = ["2026-11-01", "2026-11-02"]
  assert.deepEqual(
    datesToRefresh(["2026-11-02", "2026-12-09", "2026-11-02"], visible),
    ["2026-11-02"]
  )
  assert.deepEqual(datesToRefresh([], visible), [])
})

test("runLimited never runs more than limit at once", async () => {
  let running = 0
  let peak = 0
  const resolvers: (() => void)[] = []
  const tasks = Array.from({ length: 5 }, (_, i) => () => {
    running++
    peak = Math.max(peak, running)
    return new Promise<number>((res) => {
      resolvers.push(() => {
        running--
        res(i)
      })
    })
  })
  const p = runLimited(tasks, 2)
  // let tasks start and finish in waves
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setImmediate(r))
    resolvers.splice(0, resolvers.length).forEach((f) => f())
  }
  const out = await p
  assert.equal(peak, 2)
  assert.equal(out.length, 5)
  assert.deepEqual(
    out.map((o) => (o.status === "fulfilled" ? o.value : -1)),
    [0, 1, 2, 3, 4]
  )
})

test("runLimited reports rejections without stopping the rest", async () => {
  const out = await runLimited(
    [() => Promise.reject(new Error("x")), () => Promise.resolve(1)],
    1
  )
  assert.equal(out[0].status, "rejected")
  assert.equal(out[1].status, "fulfilled")
})

test("dayKey differs by patient", () => {
  const a = dayKey("c1", "service", "t1", "2026-11-04")
  const b = dayKey("c1", "service", "t1", "2026-11-04", "p1")
  assert.notEqual(a, b)
  assert.equal(a, dayKey("c1", "service", "t1", "2026-11-04"))
})

test("cache ignores results for a stale key", () => {
  assert.equal(isCurrent("a|1", "a|1"), true)
  assert.equal(isCurrent("a|1", "b|2"), false)
})

test("createLimiter: callers share the limit and every result comes back", async () => {
  const run = createLimiter(2)
  let active = 0
  let peak = 0
  const task = (v: number) => async () => {
    active++
    peak = Math.max(peak, active)
    await new Promise((r) => setTimeout(r, 5))
    active--
    return v
  }
  const out = await Promise.all([1, 2, 3, 4, 5].map((v) => run(task(v))))
  assert.deepEqual(out, [1, 2, 3, 4, 5])
  assert.equal(peak, 2)
})

test("createLimiter: a failing task rejects its caller and frees its place", async () => {
  const run = createLimiter(1)
  await assert.rejects(
    run(() => {
      throw new Error("boom")
    }),
    /boom/
  )
  assert.equal(await run(async () => "next"), "next")
})
