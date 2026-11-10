import { test } from "node:test";
import assert from "node:assert/strict";

import { isRecordSheet } from "./record-sheet.ts";

const vitc = { layout: "campos", render: null, sections: [{ tipo: "texto_libre", estilo: "caja" }, { tipo: "firmas" }] };

test("isRecordSheet: Vit C / BPC-157 / Plaquex as they are on prod", () => {
  assert.equal(isRecordSheet(vitc), true);
  assert.equal(isRecordSheet({ ...vitc, render: { ocultarEmpresa: false } }), true, "letterhead options do not change the template");
});

test("isRecordSheet: other templates are left alone", () => {
  assert.equal(isRecordSheet({ ...vitc, render: { camposEnLinea: ["paciente"], subrayarValores: true } }), false, "Sónica");
  assert.equal(isRecordSheet({ ...vitc, layout: "tabla" }), false);
  assert.equal(isRecordSheet({ ...vitc, sections: [{ tipo: "texto_libre", estilo: "lineas" }, { tipo: "firmas" }] }), false);
  assert.equal(isRecordSheet({ ...vitc, sections: [{ tipo: "checklist" }, { tipo: "texto_libre" }, { tipo: "firmas" }] }), false);
});
