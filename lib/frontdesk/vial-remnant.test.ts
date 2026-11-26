import { test } from "node:test";
import assert from "node:assert/strict";

import { isRemnantVisit, remnantsToShow } from "./vial-remnant.ts";

test("a remnant visit: vial service, attended, quantity 0 — nothing else", () => {
  assert.equal(isRemnantVisit({ status: "asistido", quantity: 0 }, "vial"), true);
  assert.equal(isRemnantVisit({ status: "asistido", quantity: 1 }, "vial"), false);
  assert.equal(isRemnantVisit({ status: "presente", quantity: 0 }, "vial"), false);
  assert.equal(isRemnantVisit({ status: "asistido", quantity: 0 }, "visit"), false);
  assert.equal(isRemnantVisit(null, "vial"), false);
});

test("remnants to show: the product's, usable before expired, empty ones dropped", () => {
  const vials = [
    { id: "old", productId: "plaquex", remaining: 5, expired: true },
    { id: "ok", productId: "plaquex", remaining: 20, expired: false },
    { id: "done", productId: "plaquex", remaining: 0, expired: false },
    { id: "other", productId: "vitc", remaining: 10, expired: false },
  ];
  assert.deepEqual(remnantsToShow(vials, "plaquex").map((v) => v.id), ["ok", "old"]);
  assert.deepEqual(remnantsToShow(vials).map((v) => v.id), ["ok", "other", "old"]);
});

test("a remnant visit is a done session: not served or called never is; stage columns alone count", () => {
  assert.equal(isRemnantVisit({ status: "cancelada", presentAt: "2026-11-26T13:00:00Z", quantity: 0 }, "vial"), false);
  assert.equal(isRemnantVisit({ status: "presente", calledAt: "2026-11-26T13:00:00Z", quantity: 0 }, "vial"), false);
  assert.equal(isRemnantVisit({ bookingStatus: "arrived", careStatus: "done", quantity: 0 }, "vial"), true);
});
