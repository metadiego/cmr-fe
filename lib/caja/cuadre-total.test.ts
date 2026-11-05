// TDD de los helpers puros del cuadre TOTAL del día. Correr: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import {
  puedeVerCuadreTotal,
  puedeContarCuadreTotal,
  puedeCerrarCuadreTotal,
  esSoloLecturaCuadreTotal,
  resumenComprobacion,
} from "./cuadre-total.ts";
import type { ComprobacionCuadreTotal } from "../api/caja.ts";

test("puedeVerCuadreTotal exige caja.read Y caja.ver_todos", () => {
  assert.equal(puedeVerCuadreTotal({ leer: true, verTodos: true }), true);
  assert.equal(puedeVerCuadreTotal({ leer: true, verTodos: false }), false);
  assert.equal(puedeVerCuadreTotal({ leer: false, verTodos: true }), false);
});

test("puedeContarCuadreTotal exige caja.create Y caja.ver_todos", () => {
  assert.equal(puedeContarCuadreTotal({ crear: true, verTodos: true }), true);
  assert.equal(puedeContarCuadreTotal({ crear: true, verTodos: false }), false);
  assert.equal(puedeContarCuadreTotal({ crear: false, verTodos: true }), false);
});

test("puedeCerrarCuadreTotal exige caja.cerrar Y caja.ver_todos", () => {
  assert.equal(puedeCerrarCuadreTotal({ cerrar: true, verTodos: true }), true);
  assert.equal(puedeCerrarCuadreTotal({ cerrar: true, verTodos: false }), false);
  assert.equal(puedeCerrarCuadreTotal({ cerrar: false, verTodos: true }), false);
});

test("esSoloLecturaCuadreTotal: solo 'cerrado' es solo lectura", () => {
  assert.equal(esSoloLecturaCuadreTotal("cerrado"), true);
  assert.equal(esSoloLecturaCuadreTotal("abierto"), false);
  assert.equal(esSoloLecturaCuadreTotal(undefined), false);
});

const columna = (over: Partial<ComprobacionCuadreTotal["day"]> = {}) => ({
  expected: 100,
  counted: 100,
  fund: 50,
  difference: 0,
  ...over,
});

function check(over: Partial<ComprobacionCuadreTotal> = {}): ComprobacionCuadreTotal {
  return {
    consultation: columna(),
    general: columna(),
    sum: columna(),
    day: columna(),
    squares: true,
    gap: 0,
    ...over,
  };
}

test("resumenComprobacion: sin conteo único es 'suma', cuadra = sin descuadre", () => {
  const r = resumenComprobacion(check(), false);
  assert.deepEqual(r, { modo: "suma", descuadre: false, gap: 0 });
});

test("resumenComprobacion: con conteo único (ownCount) es 'conteo'", () => {
  const r = resumenComprobacion(check(), true);
  assert.equal(r.modo, "conteo");
});

test("resumenComprobacion: squares=false avisa descuadre aunque gap sea 0", () => {
  const r = resumenComprobacion(check({ squares: false, gap: 0 }), false);
  assert.equal(r.descuadre, true);
  assert.equal(r.gap, 0);
});

test("resumenComprobacion: gap distinto de cero avisa descuadre con la cifra exacta del BE", () => {
  const r = resumenComprobacion(check({ squares: true, gap: -12.5 }), false);
  assert.equal(r.descuadre, true);
  assert.equal(r.gap, -12.5);
});
