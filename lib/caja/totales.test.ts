// TDD de los helpers puros del cuadre. Correr: `npm test` (usa `node --test --experimental-strip-types`,
// sin dependencias nuevas). See docs/specs/2026-07-20-cuadre-caja-design.md.
import test from "node:test";
import assert from "node:assert/strict";
import {
  totalConteo,
  diferenciaCaja,
  ordenarDenominaciones,
  estadoCuadreVivo,
  subtotalesTarjeta,
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

test("diferenciaCaja: Short −50 (ejemplo CMA Laser): contado 2761.36, inicio 50, ventas 2761.36", () => {
  assert.equal(diferenciaCaja(2761.36, 50, 2761.36), -50);
});

test("diferenciaCaja: Perfect (0) cuando contado = inicio + ventas", () => {
  assert.equal(diferenciaCaja(2811.36, 50, 2761.36), 0);
});

test("diferenciaCaja: Over (positivo) cuando sobra efectivo", () => {
  assert.equal(diferenciaCaja(250, 50, 100), 100); // 250 − 50 − 100 = 100 sobra
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

test("estadoCuadreVivo: sin reconciliación aún (primera carga) usa la fórmula local", () => {
  const r = estadoCuadreVivo({
    escribiendo: false,
    contadoLocal: 0,
    inicioLocal: 50,
    salesCash: 100,
    reconciliacion: null,
  });
  assert.deepEqual(r, { contado: 0, inicio: 50, aDepositar: -50, diferencia: -150, sinContar: false });
});

test("estadoCuadreVivo: escribiendo (cajero contando en vivo) ignora al BE aunque diga sin contar", () => {
  const r = estadoCuadreVivo({
    escribiendo: true,
    contadoLocal: 150,
    inicioLocal: 50,
    salesCash: 100,
    reconciliacion: { contado: false, fondoInicial: 0, countedCash: 0, expectedCash: 100, difference: -100 },
  });
  assert.deepEqual(r, { contado: 150, inicio: 50, aDepositar: 100, diferencia: 0, sinContar: false });
});

test("estadoCuadreVivo: BUG REAL — nadie contó ($100 esperado, $0 contado) nunca es un $0.00 verde", () => {
  const r = estadoCuadreVivo({
    escribiendo: false,
    contadoLocal: 0,
    inicioLocal: 0,
    salesCash: 100,
    reconciliacion: { contado: false, fondoInicial: 0, countedCash: 0, expectedCash: 100, difference: -100 },
  });
  assert.equal(r.sinContar, true);
  assert.equal(r.diferencia, -100);
});

test("estadoCuadreVivo: con conteo real guardado, usa la reconciliación del BE tal cual (sobrante)", () => {
  const r = estadoCuadreVivo({
    escribiendo: false,
    contadoLocal: 0,
    inicioLocal: 0,
    salesCash: 800,
    reconciliacion: { contado: true, fondoInicial: 50, countedCash: 870, expectedCash: 800, difference: 20 },
  });
  assert.deepEqual(r, { contado: 870, inicio: 50, aDepositar: 820, diferencia: 20, sinContar: false });
});

test("money formatea a $0.00, con separador de miles, y tolera NaN", () => {
  // El pie del cuadre lee cifras de miles de un vistazo: money lleva separador de miles (bd4fe49).
  assert.equal(money(1234.5), "$1,234.50");
  assert.equal(money(0), "$0.00");
  assert.equal(money(Number.NaN), "$0.00");
});

test("subtotalesTarjeta: sin grupo padre (ningún porGrupo iguala totalTarjetas) no da subtotales", () => {
  const grupos = [{ slug: "visa_mc", labelKey: "x", name: "Visa+MC", paymentMethods: ["visa", "mc"] }];
  assert.deepEqual(subtotalesTarjeta(grupos, { visa_mc: 50 }, 100), []);
});

test("subtotalesTarjeta: subconjunto estricto del padre se reporta; el padre y los que no son subconjunto no", () => {
  const grupos = [
    { slug: "tarjetas", labelKey: "k.tarjetas", name: "Tarjetas", paymentMethods: ["visa", "mc", "amex"] },
    { slug: "visa_mc", labelKey: "k.visa_mc", name: "Visa+MC", paymentMethods: ["visa", "mc"] },
    { slug: "ath", labelKey: "k.ath", name: "ATH", paymentMethods: ["ath"] }, // no es tarjeta: no entra
  ];
  const porGrupo = { tarjetas: 100, visa_mc: 80, ath: 40 };
  assert.deepEqual(subtotalesTarjeta(grupos, porGrupo, 100), [
    { clave: "visa_mc", labelKey: "k.visa_mc", nombre: "Visa+MC", monto: 80 },
  ]);
});

test("subtotalesTarjeta: un subconjunto en $0 se omite (nada que mostrar)", () => {
  const grupos = [
    { slug: "tarjetas", labelKey: "k.tarjetas", name: "Tarjetas", paymentMethods: ["visa", "mc"] },
    { slug: "mc_solo", labelKey: "k.mc_solo", name: "Solo MC", paymentMethods: ["mc"] },
  ];
  assert.deepEqual(subtotalesTarjeta(grupos, { tarjetas: 100, mc_solo: 0 }, 100), []);
});
