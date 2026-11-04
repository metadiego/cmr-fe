// Reads across clinics (lib/clinic-read-scope.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { oneCenterIds, readCenterIds } from "./clinic-read-scope.ts";

test("a screen's picked center is sent as centerIds, so the read does not depend on the BE default", () => {
  assert.deepEqual(readCenterIds("cag", undefined), ["cag"]);
});

test("explicit centerIds win over the picked center", () => {
  assert.deepEqual(readCenterIds("cag", ["bay", "cag"]), ["bay", "cag"]);
});

test("nothing picked and nothing asked: nothing sent", () => {
  assert.equal(readCenterIds(undefined, undefined), undefined);
  assert.equal(readCenterIds(undefined, []), undefined);
});


test("a one-center read names the picked center, else the active one, else the session's", () => {
  assert.deepEqual(oneCenterIds("cag", "bay", "bay"), ["cag"]);
  assert.deepEqual(oneCenterIds(undefined, "cag", "bay"), ["cag"]);
  assert.deepEqual(oneCenterIds(undefined, null, "bay"), ["bay"]);
});

test("a combined view (tenant null) or no center at all sends nothing: the BE reads the whole scope", () => {
  assert.equal(oneCenterIds(null, "cag", "bay"), undefined);
  assert.equal(oneCenterIds(undefined, null, null), undefined);
});
