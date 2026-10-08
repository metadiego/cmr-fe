import { test } from "node:test";
import assert from "node:assert/strict";
import { sendToHubs, testTicketToEscPos } from "./hub.ts";

const A = "https://central:8943/print-raw?q=1";
const B = "http://localhost:8943/print-raw?q=1";
const bytes = new Uint8Array([1, 2, 3]);

test("first hub prints → the others are not tried", async () => {
  const tried: string[] = [];
  const i = await sendToHubs([A, B], bytes, async (u) => { tried.push(u); });
  assert.equal(i, 0);
  assert.deepEqual(tried, [A]);
});

test("central hub down → the local hub prints (the printer's own machine keeps printing)", async () => {
  const tried: string[] = [];
  const i = await sendToHubs([A, B], bytes, async (u) => {
    tried.push(u);
    if (u === A) throw new TypeError("Failed to fetch");
  });
  assert.equal(i, 1);
  assert.deepEqual(tried, [A, B]);
});

test("every hub fails → one error naming each hub", async () => {
  await assert.rejects(
    sendToHubs([A, B], bytes, async (u) => { throw new Error(u === A ? "down" : "hub 502: printer off"); }),
    /central:8943: down · localhost:8943: hub 502: printer off/,
  );
});

test("no hubs → error, nothing sent", async () => {
  await assert.rejects(sendToHubs([], bytes, async () => { throw new Error("must not be called"); }), /no hub configured/);
});

test("test ticket: init, the lines, cut", () => {
  const b = testTicketToEscPos(["HUB TEST", "Caguas"]);
  assert.deepEqual([...b.slice(0, 2)], [0x1b, 0x40]);
  assert.deepEqual([...b.slice(-4)], [0x1d, 0x56, 0x41, 0x03]);
  assert.ok(Buffer.from(b).includes(Buffer.from("Caguas")));
});
