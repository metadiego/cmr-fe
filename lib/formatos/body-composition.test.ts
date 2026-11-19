import { test } from "node:test";
import assert from "node:assert/strict";

import { headerLines, isMeasured, isTickBox } from "./body-composition.ts";

const prod = [
  { clave: "paciente", origen: "paciente.nombre" },
  { clave: "record", origen: "paciente.record" },
  { clave: "peso", origen: "scale.weightLbs" },
  { clave: "sesion", origen: "sesion.sesiones" },
];

test("headerLines: name, record and weight first; the session alone under them", () => {
  const { first, second } = headerLines(prod);
  assert.deepEqual(first.map((f) => f.clave), ["paciente", "record", "peso"]);
  assert.deepEqual(second.map((f) => f.clave), ["sesion"]);
});

test("isMeasured: scale and tape values only", () => {
  assert.equal(isMeasured({ clave: "peso", origen: "scale.weightLbs" }), true);
  assert.equal(isMeasured({ clave: "cuello", origen: "tape.neck" }), true);
  assert.equal(isMeasured({ clave: "record", origen: "paciente.record" }), false);
  assert.equal(isMeasured({ clave: "x" }), false);
});

test("isTickBox: the prod dose cell is a box; text and empty are not", () => {
  assert.equal(isTickBox({ segmentos: [{ opciones: [""] }] }), true);
  assert.equal(isTickBox("0.25 ml"), false);
  assert.equal(isTickBox(""), false);
  assert.equal(isTickBox(undefined), false);
  assert.equal(isTickBox({ segmentos: [{ texto: "a" }] }), false);
});
