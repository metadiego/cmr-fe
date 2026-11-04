// Reads across clinics (lib/clinic-read-scope.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { clinicFilterChoice, oneCenterIds, readCenterIds, showsClinicColumn } from "./clinic-read-scope.ts";

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

test("a list over several centers names exactly those; an empty list is every center in scope", () => {
  assert.deepEqual(oneCenterIds(["bay", "cag"], "bay", "bay"), ["bay", "cag"]);
  assert.equal(oneCenterIds([], "bay", "bay"), undefined);
});

test("the clinic filter: nothing chosen reads every readable clinic, a choice narrows, stale ids drop", () => {
  assert.equal(clinicFilterChoice(["bay", "cag"], null), null);
  assert.deepEqual(clinicFilterChoice(["bay", "cag"], ["cag"]), ["cag"]);
  assert.equal(clinicFilterChoice(["bay", "cag"], ["pon"]), null);
  assert.equal(clinicFilterChoice(["bay", "cag"], ["bay", "cag"]), null);
});

test("the clinic column shows for anyone who can read more than one clinic, even filtered to one", () => {
  assert.equal(showsClinicColumn(["bay", "cag"]), true);
  assert.equal(showsClinicColumn(["bay"]), false);
  assert.equal(showsClinicColumn([]), false);
});
