import { test } from "node:test";
import assert from "node:assert/strict";

import { apiKeyFormMissing } from "./create-missing.ts";

const labels = { name: "Name", permissions: "Permissions" };
const base = { name: "scale Caguas", centerId: "cag", fullAccess: false, permissions: ["inventory.scale"], expiresAt: "" };

test("a named key with one permission is complete", () => {
  assert.deepEqual(apiKeyFormMissing(base, labels), []);
});

test("name and permissions are what can be missing, in screen order", () => {
  assert.deepEqual(apiKeyFormMissing({ ...base, name: "  ", permissions: [] }, labels), ["Name", "Permissions"]);
});

test("full access on an all-centers key needs no permission list", () => {
  assert.deepEqual(apiKeyFormMissing({ ...base, centerId: "__all__", fullAccess: true, permissions: [] }, labels), []);
});

test("full access does not count for a center key (the BE refuses it there)", () => {
  assert.deepEqual(apiKeyFormMissing({ ...base, fullAccess: true, permissions: [] }, labels), ["Permissions"]);
});
