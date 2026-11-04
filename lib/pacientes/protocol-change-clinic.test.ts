// The clinic a protocol change is made in (lib/pacientes/protocol-change-clinic.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { protocolChangeClinic, protocolChangeClinics } from "./protocol-change-clinic.ts";

const BOTH = ["bay", "cag"];

test("the person's pick wins, then a ?centro= link, then the top bar", () => {
  assert.equal(protocolChangeClinic(BOTH, "cag", "bay", "bay"), "cag");
  assert.equal(protocolChangeClinic(BOTH, null, "cag", "bay"), "cag");
  assert.equal(protocolChangeClinic(BOTH, null, null, "cag"), "cag");
});

test("a clinic without the permission is skipped; the first allowed one is the fallback", () => {
  assert.equal(protocolChangeClinic(BOTH, null, "other", "other"), "bay");
  assert.equal(protocolChangeClinic(["cag"], null, null, "bay"), "cag");
});

test("while the allowed clinics are unknown, the link's or the top bar's clinic is used", () => {
  assert.equal(protocolChangeClinic([], null, "cag", "bay"), "cag");
  assert.equal(protocolChangeClinic([], null, null, "bay"), "bay");
  assert.equal(protocolChangeClinic([], null, null, null), null);
});

test("one form per clinic where the patient has pending packages, in the allowed order", () => {
  assert.deepEqual(protocolChangeClinics(BOTH, ["cag", "bay", "cag"], "bay"), ["bay", "cag"]);
  assert.deepEqual(protocolChangeClinics(BOTH, ["cag"], "bay"), ["cag"]);
});

test("no pending package anywhere (or a clinic without the permission): the one clinic, so the form says so", () => {
  assert.deepEqual(protocolChangeClinics(BOTH, [], "bay"), ["bay"]);
  assert.deepEqual(protocolChangeClinics(BOTH, ["pon"], "bay"), ["bay"]);
});

test("one allowed clinic, or none known yet: just the one clinic", () => {
  assert.deepEqual(protocolChangeClinics(["bay"], ["bay"], "bay"), ["bay"]);
  assert.deepEqual(protocolChangeClinics([], [], "bay"), ["bay"]);
  assert.deepEqual(protocolChangeClinics([], [], null), []);
});
