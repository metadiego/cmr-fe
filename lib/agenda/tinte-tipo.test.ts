import { test } from "node:test";
import assert from "node:assert/strict";

import { tinteFila, esTipoNueva } from "./tinte-tipo.ts";

test("esTipoNueva: por clave o por nombre; el resto no", () => {
  assert.equal(esTipoNueva("nueva", null), true);
  assert.equal(esTipoNueva(null, "Consulta (Nueva)"), true);
  assert.equal(esTipoNueva("seguimiento", "Seguimiento"), false);
  assert.equal(esTipoNueva("control", "Control"), false);
  assert.equal(esTipoNueva(null, null), false);
});

test("null / vacío / inválido → sin tinte", () => {
  assert.equal(tinteFila(null), undefined);
  assert.equal(tinteFila(undefined), undefined);
  assert.equal(tinteFila(""), undefined);
  assert.equal(tinteFila("azul"), undefined);
  assert.equal(tinteFila("#12"), undefined);
});

test("color claro (ámbar #FFF3CD) se usa tal cual", () => {
  assert.equal(tinteFila("#FFF3CD"), "rgb(255, 243, 205)");
});

test("color saturado (verde/azul) baja a capa suave 12%", () => {
  assert.equal(tinteFila("#28a745"), "rgba(40, 167, 69, 0.12)");
  assert.equal(tinteFila("#4a90d9"), "rgba(74, 144, 217, 0.12)");
});

test("acepta hex de 3 dígitos y sin #", () => {
  assert.equal(tinteFila("fff"), "rgb(255, 255, 255)"); // claro → tal cual
  assert.equal(tinteFila("#000"), "rgba(0, 0, 0, 0.12)"); // oscuro → suave
});
