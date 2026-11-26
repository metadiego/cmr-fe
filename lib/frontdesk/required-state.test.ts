import { test } from "node:test";
import assert from "node:assert/strict";

import { requiredStateMet } from "./required-state.ts";

test("no requirement → always met", () => {
  assert.equal(requiredStateMet({ required: undefined }), true);
});

test("stale session map but the row is presente → met (Caguas 05-nov, 15059/15921)", () => {
  assert.equal(
    requiredStateMet({ required: "presente", sessionStamp: null, row: { status: "presente" }, rowStamp: "2026-11-05T19:10:28Z" }),
    true,
  );
});

test("row state alone at or past the requirement → met", () => {
  assert.equal(requiredStateMet({ required: "presente", row: { status: "en_terapia" } }), true);
  assert.equal(requiredStateMet({ required: "presente", row: { status: "asistido" } }), true);
});

test("session stamp alone → met", () => {
  assert.equal(requiredStateMet({ required: "presente", sessionStamp: "2026-11-05T19:10:28Z", row: { status: "pendiente" } }), true);
});

test("still pendiente with no stamps → locked", () => {
  assert.equal(requiredStateMet({ required: "presente", row: { status: "pendiente" } }), false);
  assert.equal(requiredStateMet({ required: "presente", row: { status: "cancelada" } }), false);
});

test("unknown required state without stamps → locked (never opens by accident)", () => {
  assert.equal(requiredStateMet({ required: "otro", row: { status: "asistido" } }), false);
});

test("the row is read by its stage group: called is waiting (presente met, en_terapia not); not served is locked", () => {
  const called = { status: "presente", calledAt: "2026-11-26T13:00:00Z" };
  assert.equal(requiredStateMet({ required: "presente", row: called }), true);
  assert.equal(requiredStateMet({ required: "en_terapia", row: called }), false);
  const notServed = { status: "cancelada", presentAt: "2026-11-26T13:00:00Z" };
  assert.equal(requiredStateMet({ required: "presente", row: notServed }), false);
  assert.equal(requiredStateMet({ required: "presente", row: { bookingStatus: "arrived", careStatus: "in_therapy" } }), true);
});
