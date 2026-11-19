import { test } from "node:test";
import assert from "node:assert/strict";

import { controlHeaderLayout, splitControlTitle } from "./control-sheet.ts";

test("splitControlTitle: «X · Y» → X big, Y below; without the dot, one line", () => {
  assert.deepEqual(splitControlTitle("TERAPIA MAGNETRÓN (EMTT) · CONTROL de SESIONES"), {
    main: "TERAPIA MAGNETRÓN (EMTT)",
    sub: "CONTROL de SESIONES",
  });
  assert.deepEqual(splitControlTitle("AVACEN"), { main: "AVACEN", sub: null });
  assert.deepEqual(splitControlTitle(null), { main: "", sub: null });
});

const f = (clave: string, origen: string) => ({ clave, origen });

test("controlHeaderLayout: 2 fields spread; EMTT stacks Área; Cámara puts the hand fields on one row", () => {
  const avacen = controlHeaderLayout([f("paciente", "paciente.nombre"), f("record", "paciente.record")]);
  assert.deepEqual(avacen.spread?.map((x) => x.clave), ["paciente", "record"]);

  const emtt = controlHeaderLayout([f("paciente", "paciente.nombre"), f("record", "paciente.record"), f("area", "")]);
  assert.equal(emtt.spread, null);
  assert.deepEqual(emtt.stacked.map((x) => x.clave), ["paciente", "record", "area"]);
  assert.deepEqual(emtt.handRow, []);

  const camara = controlHeaderLayout([
    f("paciente", "paciente.nombre"),
    f("record", "paciente.record"),
    f("pemf", ""),
    f("camara_energetica", ""),
    f("camara_hiperbarica", ""),
  ]);
  assert.deepEqual(camara.stacked.map((x) => x.clave), ["paciente", "record"]);
  assert.deepEqual(camara.handRow.map((x) => x.clave), ["pemf", "camara_energetica", "camara_hiperbarica"]);
});
