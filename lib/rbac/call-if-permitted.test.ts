import { test } from "node:test";
import assert from "node:assert/strict";

import { callIfPermitted } from "./call-if-permitted.ts";

test("never calls the fetcher when the permission is missing", async () => {
  let called = false;
  const result = await callIfPermitted(["other.permission"], "invoice.read", async () => {
    called = true;
    return [{ id: "1" }];
  }, []);
  assert.equal(called, false);
  assert.deepEqual(result, []);
});

test("calls the fetcher when the permission is held", async () => {
  let called = false;
  const result = await callIfPermitted(["invoice.read"], "invoice.read", async () => {
    called = true;
    return [{ id: "1" }];
  }, []);
  assert.equal(called, true);
  assert.deepEqual(result, [{ id: "1" }]);
});

test("the master wildcard also calls the fetcher", async () => {
  let called = false;
  await callIfPermitted(["*"], "resources.read", async () => {
    called = true;
    return null;
  }, null);
  assert.equal(called, true);
});

test("an old Spanish alias still holds the new canonical permission", async () => {
  let called = false;
  // factura.read is the old key for invoice.read (lib/rbac/permission-aliases.ts).
  await callIfPermitted(["factura.read"], "invoice.read", async () => {
    called = true;
    return [];
  }, []);
  assert.equal(called, true);
});
