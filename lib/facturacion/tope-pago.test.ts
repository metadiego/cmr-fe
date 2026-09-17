import { test } from "node:test";
import assert from "node:assert/strict";

import { topePago, pagoExcede, EPS_PAGO } from "./tope-pago.ts";

test("topePago: al agregar, el tope es el saldo (total − abonado)", () => {
  assert.equal(topePago(100, 80), 20);
  assert.equal(topePago(100, 0), 100);
});

test("topePago: al editar, el importe actual del pago se libera (saldo + montoActual)", () => {
  // total 100, abonado 80 (de los cuales este pago aporta 50) → puede subir hasta 70.
  assert.equal(topePago(100, 80, 50), 70);
});

test("topePago: nunca es negativo (factura ya sobre-abonada o saldada)", () => {
  assert.equal(topePago(10, 15), 0);
  assert.equal(topePago(0, 0), 0);
});

test("pagoExcede: bloquea por encima del tope, admite el tope exacto", () => {
  assert.equal(pagoExcede(21, 20), true);
  assert.equal(pagoExcede(20, 20), false);
});

test("pagoExcede: holgura de centavos (no bloquea por flotantes)", () => {
  assert.equal(pagoExcede(20 + EPS_PAGO / 2, 20), false);
  assert.equal(pagoExcede(20.01, 20), true);
});

test("caso real del reporte: total 10, ya abonado 10, agregar 5 → excede", () => {
  const tope = topePago(10, 10); // 0
  assert.equal(tope, 0);
  assert.equal(pagoExcede(5, tope), true);
});
