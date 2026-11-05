import { test } from "node:test";
import assert from "node:assert/strict";

import { requiredStateMet } from "./required-state.ts";

test("no requirement → always met", () => {
  assert.equal(requiredStateMet({ required: undefined }), true);
});

test("stale session map but the row is presente → met (Caguas 05-nov, 15059/15921)", () => {
  assert.equal(
    requiredStateMet({ required: "presente", sessionStamp: null, rowState: "presente", rowStamp: "2026-11-05T19:10:28Z" }),
    true,
  );
});

test("row state alone at or past the requirement → met", () => {
  assert.equal(requiredStateMet({ required: "presente", rowState: "en_terapia" }), true);
  assert.equal(requiredStateMet({ required: "presente", rowState: "asistido" }), true);
});

test("session stamp alone → met", () => {
  assert.equal(requiredStateMet({ required: "presente", sessionStamp: "2026-11-05T19:10:28Z", rowState: "pendiente" }), true);
});

test("still pendiente with no stamps → locked", () => {
  assert.equal(requiredStateMet({ required: "presente", rowState: "pendiente" }), false);
  assert.equal(requiredStateMet({ required: "presente", rowState: "cancelada" }), false);
});

test("unknown required state without stamps → locked (never opens by accident)", () => {
  assert.equal(requiredStateMet({ required: "otro", rowState: "asistido" }), false);
});
