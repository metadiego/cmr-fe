import { test } from "node:test";
import assert from "node:assert/strict";

import { keyStatus, isFullAccess, summarize, sortKeys, inTopBarCenter } from "./key-status.ts";

const now = new Date("2026-11-20T12:00:00Z");
const base = {
  id: "k",
  name: "k",
  keyPrefix: "cmr_ak_aa",
  scope: "admin" as const,
  clinicId: null,
  permissions: ["*"],
  expiresAt: null,
  revokedAt: null,
  createdBy: null,
  createdAt: "2026-01-01T00:00:00Z",
  lastUsedAt: null,
};

test("revoked wins over everything else", () => {
  assert.equal(keyStatus({ ...base, revokedAt: "2026-11-01T00:00:00Z", expiresAt: "2026-01-01T00:00:00Z" }, now), "revoked");
});

test("expired = not revoked and the expiry already passed", () => {
  assert.equal(keyStatus({ ...base, expiresAt: "2026-11-20T11:59:59Z" }, now), "expired");
  assert.equal(keyStatus({ ...base, expiresAt: "2026-11-21T00:00:00Z", lastUsedAt: "2026-11-19T00:00:00Z" }, now), "active");
});

test("active, split by whether anything ever used it", () => {
  assert.equal(keyStatus(base, now), "neverUsed");
  assert.equal(keyStatus({ ...base, lastUsedAt: "2026-11-19T00:00:00Z" }, now), "active");
});

test("full access = carries the wildcard", () => {
  assert.equal(isFullAccess(base), true);
  assert.equal(isFullAccess({ ...base, permissions: ["inventory.scale"] }), false);
});

test("summary counts the live keys, the full-access ones and the never-used ones", () => {
  const keys = [
    base,
    { ...base, id: "2", lastUsedAt: "2026-11-19T00:00:00Z" },
    { ...base, id: "3", permissions: ["print_hub.process"], lastUsedAt: "2026-11-19T00:00:00Z" },
    { ...base, id: "4", revokedAt: "2026-11-01T00:00:00Z" },
  ];
  assert.deepEqual(summarize(keys, now), { live: 3, fullAccess: 2, neverUsed: 1, neverUsedFullAccess: 1 });
});

test("order: the risky ones first (never used with full access), then live, then the dead", () => {
  const keys = [
    { ...base, id: "revoked", revokedAt: "2026-11-01T00:00:00Z" },
    { ...base, id: "used", name: "b", lastUsedAt: "2026-11-19T00:00:00Z" },
    { ...base, id: "limited-unused", name: "a", permissions: ["x.read"] },
    { ...base, id: "full-unused", name: "z" },
  ];
  assert.deepEqual(sortKeys(keys, now).map((k) => k.id), ["full-unused", "limited-unused", "used", "revoked"]);
});

test("the top bar filters center keys; all-centers keys always show", () => {
  const all = { ...base, id: "all", clinicId: null };
  const bay = { ...base, id: "bay", scope: "clinic" as const, clinicId: "bayamon", permissions: ["x"] };
  const cag = { ...base, id: "cag", scope: "clinic" as const, clinicId: "caguas", permissions: ["x"] };
  const ids = (ks: { id: string }[]) => ks.map((k) => k.id);
  // One center picked: its keys and the all-centers ones (they work there too), not the other center's.
  assert.deepEqual(ids(inTopBarCenter([all, bay, cag], ["bayamon"])), ["all", "bay"]);
  // «Ambos» (no single center): everything.
  assert.deepEqual(ids(inTopBarCenter([all, bay, cag], null)), ["all", "bay", "cag"]);
});
