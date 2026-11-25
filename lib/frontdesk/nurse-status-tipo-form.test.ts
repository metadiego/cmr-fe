import { test } from "node:test";
import assert from "node:assert/strict";

import { durationOptionsHasInvalidToken, labelKeyFor, parseDurationOptions, slugify } from "./nurse-status-tipo-form.ts";

test("slugify: lowercase, ascii, snake_case", () => {
  assert.equal(slugify("Descanso"), "descanso");
  assert.equal(slugify("En triage"), "en_triage");
  assert.equal(slugify("  Almuerzo  "), "almuerzo");
});

test("slugify: accents are folded, not dropped with their letter", () => {
  assert.equal(slugify("Añadió"), "anadio");
  assert.equal(slugify("Atención médica"), "atencion_medica");
});

test("slugify: punctuation becomes underscores, not doubled or leading/trailing", () => {
  assert.equal(slugify("¿Vacunación?"), "vacunacion");
  assert.equal(slugify("Pausa - corta"), "pausa_corta");
});

test("labelKeyFor: the BE's own convention", () => {
  assert.equal(labelKeyFor("descanso"), "nurse_status.descanso");
});

test("parseDurationOptions: dedupes and sorts ascending", () => {
  assert.deepEqual(parseDurationOptions("30, 10, 10, 60"), [10, 30, 60]);
});

test("parseDurationOptions: drops anything outside 1–720 whole minutes", () => {
  assert.deepEqual(parseDurationOptions("0, 15, 721, 45.5, abc"), [15]);
});

test("parseDurationOptions: empty text is an empty list (clears it, per the BE contract)", () => {
  assert.deepEqual(parseDurationOptions(""), []);
  assert.deepEqual(parseDurationOptions("   "), []);
});

test("parseDurationOptions: space-separated works the same as comma-separated", () => {
  assert.deepEqual(parseDurationOptions("10 30 60"), [10, 30, 60]);
});

test("durationOptionsHasInvalidToken: flags a bad token even when valid ones exist alongside it", () => {
  assert.equal(durationOptionsHasInvalidToken("10, 30"), false);
  assert.equal(durationOptionsHasInvalidToken("10, 999"), true);
  assert.equal(durationOptionsHasInvalidToken("10, abc"), true);
  assert.equal(durationOptionsHasInvalidToken(""), false);
});
