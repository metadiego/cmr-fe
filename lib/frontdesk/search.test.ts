// TDD del filtro de búsqueda del frontdesk (nombre/record/teléfono, insensible a acentos y mayúsculas).
// Correr: `npm test`. Ver docs/plans/fe-frontdesk-dia.md.
import test from "node:test";
import assert from "node:assert/strict";
import { normaliza, coincide } from "./search.ts";

test("normaliza quita acentos y baja a minúsculas", () => {
  assert.equal(normaliza("JOSÉ Núñez"), "jose nunez");
});

test("coincide por nombre parcial sin acentos", () => {
  assert.ok(coincide(["José Núñez", "bay123"], "nunez"));
  assert.ok(coincide(["José Núñez", "bay123"], "JOSE"));
});

test("coincide por record", () => {
  assert.ok(coincide(["María Pérez", "bay123"], "bay12"));
});

test("no coincide cuando nada matchea", () => {
  assert.equal(coincide(["María Pérez", "bay123"], "gonzalez"), false);
});

test("query vacía coincide con todo", () => {
  assert.ok(coincide(["cualquiera"], ""));
  assert.ok(coincide([], "   "));
});

test("ignora campos nulos/vacíos", () => {
  assert.equal(coincide([null, undefined, ""], "x"), false);
});
