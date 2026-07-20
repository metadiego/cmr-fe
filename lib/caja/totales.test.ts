// TDD de los helpers puros del cuadre. Correr: `npm test` (usa `node --test --experimental-strip-types`,
// sin dependencias nuevas). See docs/specs/2026-07-20-cuadre-caja-design.md.
import test from "node:test";
import assert from "node:assert/strict";
import {
  totalConteo,
  variacion,
  ordenarDenominaciones,
  money,
} from "./totales.ts";

test("totalConteo suma valor × cantidad", () => {
  assert.equal(
    totalConteo([
      { valor: 100, cantidad: 2 },
      { valor: 20, cantidad: 3 },
      { valor: 1, cantidad: 5 },
    ]),
    265,
  );
});

test("totalConteo con lista vacía = 0", () => {
  assert.equal(totalConteo([]), 0);
});

test("totalConteo ignora cantidades no positivas o NaN (no restan)", () => {
  assert.equal(
    totalConteo([
      { valor: 50, cantidad: 0 },
      { valor: 50, cantidad: -3 },
      { valor: 50, cantidad: Number.NaN },
      { valor: 10, cantidad: 2 },
    ]),
    20,
  );
});

test("variacion: (contado − petty) − esperado; positivo = sobra", () => {
  assert.equal(variacion(500, 100, 380), 20);
});

test("variacion: negativo = falta", () => {
  assert.equal(variacion(300, 50, 400), -150);
});

test("ordenarDenominaciones: por valor DESC (mayor→menor); no muta", () => {
  const input = [
    { valor: 20 },
    { valor: 100 },
    { valor: 0.25 },
    { valor: 1 },
  ];
  const out = ordenarDenominaciones(input);
  assert.deepEqual(
    out.map((d) => d.valor),
    [100, 20, 1, 0.25],
  );
  // el arreglo original no se muta
  assert.equal(input[0].valor, 20);
});

test("money formatea a $0.00 y tolera NaN", () => {
  assert.equal(money(1234.5), "$1234.50");
  assert.equal(money(0), "$0.00");
  assert.equal(money(Number.NaN), "$0.00");
});
