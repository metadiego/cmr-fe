// Reads across clinics (lib/clinic-read-scope.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { clinicFilterChoice, oneCenterIds, readCenterIds, readChoice, tenantOf, topBarSelection } from "./clinic-read-scope.ts";

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

test("the clinic filter: nothing chosen names every readable clinic, a choice narrows, stale ids drop", () => {
  assert.deepEqual(clinicFilterChoice(["bay", "cag"], null, null), ["bay", "cag"]);
  assert.deepEqual(clinicFilterChoice(["bay", "cag"], ["cag"], null), ["cag"]);
  assert.deepEqual(clinicFilterChoice(["bay", "cag"], ["pon"], null), ["bay", "cag"]);
});

test("…the active clinic goes first when it is in the list: it is the request's X-Tenant-ID", () => {
  assert.deepEqual(clinicFilterChoice(["bay", "cag"], null, "cag"), ["cag", "bay"]);
  // Not readable here: never the header, so the guard checks a clinic that has the permission.
  assert.deepEqual(clinicFilterChoice(["bay", "cag"], null, "pon"), ["bay", "cag"]);
});

test("…and while the clinics are not known yet, nothing (the BE default)", () => {
  assert.equal(clinicFilterChoice([], null, "bay"), null);
});

test("a read over several clinics sends the first as X-Tenant-ID; every clinic (null) sends none", () => {
  assert.equal(tenantOf(["cag", "bay"]), "cag");
  assert.equal(tenantOf("bay"), "bay");
  assert.equal(tenantOf(null), undefined);
  assert.equal(tenantOf([]), undefined);
});

test("the top bar on «Ambos»: a one-center read with no picked center names nothing (every center in scope)", () => {
  assert.equal(oneCenterIds(undefined, "cag", "bay", true), undefined);
  // A picked center or an explicit list still wins.
  assert.deepEqual(oneCenterIds("bay", "cag", "bay", true), ["bay"]);
  assert.deepEqual(oneCenterIds(["cag"], "cag", "bay", true), ["cag"]);
});

test("the top bar's selection: one clinic → that one; «Ambos» → nothing ticked (every readable clinic)", () => {
  assert.deepEqual(topBarSelection(false, "cag"), ["cag"]);
  assert.equal(topBarSelection(true, "cag"), null);
  assert.equal(topBarSelection(false, null), null);
  // Fed to the list's choice: one clinic narrows, «Ambos» names every readable one, active first.
  assert.deepEqual(clinicFilterChoice(["bay", "cag"], topBarSelection(false, "cag"), "cag"), ["cag"]);
  assert.deepEqual(clinicFilterChoice(["bay", "cag"], topBarSelection(true, "cag"), "cag"), ["cag", "bay"]);
});

test("readChoice: an explicit list wins, then the picked center", () => {
  assert.deepEqual(readChoice("cag", ["bay", "cag"]), ["bay", "cag"]);
  assert.equal(readChoice("cag", undefined), "cag");
  assert.equal(readChoice("cag", []), "cag");
});

test("readChoice: nothing picked follows the top bar; an explicit empty list reads every clinic", () => {
  assert.equal(readChoice(undefined, undefined), undefined);
  assert.equal(readChoice(undefined, []), null);
  // What oneCenterPath then sends: the top bar's clinic, or nothing (every clinic in scope).
  assert.deepEqual(oneCenterIds(readChoice(undefined, undefined), "bay", null), ["bay"]);
  assert.equal(oneCenterIds(readChoice(undefined, undefined), "bay", null, true), undefined);
  assert.equal(oneCenterIds(readChoice(undefined, []), "bay", null), undefined);
});
