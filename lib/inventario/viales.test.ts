import { test } from "node:test";
import assert from "node:assert/strict";

import { nivelDelFrasco, textoDeCapacidad, agruparPorDia } from "./viales.ts";

/**
 * El BE ya calcula el porcentaje y lo acota entre 0 y 100. Aquí solo se DIBUJA.
 * See docs/specs/pantalla-de-viales.md
 */
test("el relleno del frasco sigue el porcentaje que da el BE", () => {
  assert.equal(nivelDelFrasco({ porcentaje: 75 }), 75);
});

test("sin vial activo no hay frasco que llenar", () => {
  assert.equal(nivelDelFrasco(null), 0);
});

test("un remanente negativo dibuja el frasco VACÍO, no invertido", () => {
  // El BE ya manda porcentaje 0 en ese caso; el FE no puede inventar otro.
  assert.equal(nivelDelFrasco({ porcentaje: 0 }), 0);
});

test("nunca se dibuja por encima del borde", () => {
  assert.equal(nivelDelFrasco({ porcentaje: 140 }), 100);
});

test("«45 de 60 mg» se lee tal cual, con su unidad", () => {
  assert.equal(
    textoDeCapacidad({ remanente: 45, capacidad: 60 }, "mg"),
    "45 de 60 mg",
  );
});

test("los decimales del vial no se pierden ni se inventan", () => {
  assert.equal(
    textoDeCapacidad({ remanente: 1700, capacidad: 1800 }, "mcg"),
    "1,700 de 1,800 mcg",
  );
  assert.equal(
    textoDeCapacidad({ remanente: 2.5, capacidad: 5 }, "ml"),
    "2.5 de 5 ml",
  );
});

test("un remanente negativo se MUESTRA, no se esconde: es la señal de que algo se registró mal", () => {
  assert.equal(
    textoDeCapacidad({ remanente: -3, capacidad: 60 }, "mg"),
    "-3 de 60 mg",
  );
});

test("sin unidad no se escribe una unidad falsa", () => {
  assert.equal(textoDeCapacidad({ remanente: 4, capacidad: 10 }), "4 de 10");
});

test("agrupar por día ordena del más reciente al más viejo", () => {
  const r = agruparPorDia([
    { fecha: "2026-08-19T09:00:00Z", cantidad: 5 },
    { fecha: "2026-08-21T12:00:00Z", cantidad: 7.5 },
    { fecha: "2026-08-21T07:00:00Z", cantidad: 2.5 },
  ]);
  assert.deepEqual(
    r.map((g) => g.dia),
    ["2026-08-21", "2026-08-19"],
  );
  assert.equal(r[0].items.length, 2);
  assert.equal(r[0].total, 10);
});

test("sin consumos devuelve una lista vacía, no revienta", () => {
  assert.deepEqual(agruparPorDia([]), []);
});
