// The clinic a protocol change is made in (lib/pacientes/protocol-change-clinic.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { protocolChangeClinic } from "./protocol-change-clinic.ts";

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
