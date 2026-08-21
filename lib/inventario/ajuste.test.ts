import { test } from "node:test";
import assert from "node:assert/strict";

import { deltaDelConteo, ajusteDesdeConteo } from "./ajuste.ts";

/**
 * El personal cuenta lo que hay en la nevera, no la diferencia: «en la nevera tengo 54, el sistema dice
 * 55». Pedirle el delta es pedirle que haga la resta —y que la haga bien— cada vez.
 * See cmr-be/docs/specs/ajuste-de-inventario-handoff-fe.md
 */
test("contado MENOR que el sistema: resta la diferencia", () => {
  assert.deepEqual(deltaDelConteo(55, 54), { cantidad: 1, signo: "negativo" });
});

test("contado MAYOR que el sistema: suma la diferencia", () => {
  assert.deepEqual(deltaDelConteo(55, 58), { cantidad: 3, signo: "positivo" });
});

test("contado IGUAL: no hay nada que ajustar", () => {
  assert.equal(deltaDelConteo(55, 55), null);
});

test("el sistema en negativo se puede subir a lo contado", () => {
  assert.deepEqual(deltaDelConteo(-2, 3), { cantidad: 5, signo: "positivo" });
});

test("decimales de un vial: 2.5 contra 3 son 0.5 de menos, sin arrastrar basura binaria", () => {
  assert.deepEqual(deltaDelConteo(3, 2.5), { cantidad: 0.5, signo: "negativo" });
  assert.deepEqual(deltaDelConteo(0.3, 0.1), { cantidad: 0.2, signo: "negativo" });
});

test("ajusteDesdeConteo arma el cuerpo que espera el BE", () => {
  const r = ajusteDesdeConteo({
    productoId: "p1",
    almacenId: "a1",
    stockActual: 55,
    contado: 54,
    notas: "conteo de la nevera",
  });
  assert.deepEqual(r, {
    productoId: "p1",
    almacenId: "a1",
    cantidad: 1,
    signo: "negativo",
    motivo: "conteo_fisico",
    notas: "conteo de la nevera",
  });
});

test("si no hay diferencia, no se manda nada al BE", () => {
  assert.equal(
    ajusteDesdeConteo({
      productoId: "p1",
      almacenId: "a1",
      stockActual: 10,
      contado: 10,
      notas: "igual",
    }),
    null,
  );
});
