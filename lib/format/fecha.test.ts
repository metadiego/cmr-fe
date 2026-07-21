// Lock del bug off-by-one: una fecha solo-día NUNCA debe retroceder por zona horaria. Correr: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { formatFechaSolo } from "./fecha.ts";

test("fecha solo-día se formatea MM/DD/YYYY sin corrimiento", () => {
  assert.equal(formatFechaSolo("2026-07-21"), "07/21/2026");
});

test("no retrocede un día (el bug original: 07/21 salía 07/20)", () => {
  assert.notEqual(formatFechaSolo("2026-07-21"), "07/20/2026");
});

test("datetime con hora usa la fecha (parte de día)", () => {
  assert.equal(formatFechaSolo("2026-07-21T09:30:00-04:00"), "07/21/2026");
});

test("vacío/nulo → cadena vacía", () => {
  assert.equal(formatFechaSolo(""), "");
  assert.equal(formatFechaSolo(null), "");
  assert.equal(formatFechaSolo(undefined), "");
});

test("primer día del mes/año no se corre", () => {
  assert.equal(formatFechaSolo("2026-01-01"), "01/01/2026");
});
