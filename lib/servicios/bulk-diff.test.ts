// TDD del payload dirty-only para "Aplicar a todos los centros" (fix del review del PR #2).
// Correr: `npm test` (node --test --experimental-strip-types, sin dependencias nuevas).
import test from "node:test";
import assert from "node:assert/strict";
import { payloadBulkDirty, type BulkFormValues } from "./bulk-diff.ts";

const base: BulkFormValues = {
  nombre: "Intravenoso",
  color: "#3b82f6",
  orden: "5",
  grupoFacturacionId: "g-iv",
  productoId: "",
  requiereTecnico: false,
  requiereEnfermera: true,
  badge: true,
};

test("sin cambios → payload vacío (no se aplana nada)", () => {
  assert.deepEqual(payloadBulkDirty(base, { ...base }), {});
});

test("solo el campo tocado viaja (cambiar color NO arrastra nombre/orden/grupo)", () => {
  assert.deepEqual(payloadBulkDirty(base, { ...base, color: "#a1b2c3" }), {
    color: "#a1b2c3",
  });
});

test("limpiar el grupo envía null explícito (desanclar en el BE)", () => {
  assert.deepEqual(payloadBulkDirty(base, { ...base, grupoFacturacionId: "" }), {
    grupoFacturacionId: null,
  });
});

test("orden no numérico u orden vacío se OMITE (NOT NULL en el BE)", () => {
  assert.deepEqual(payloadBulkDirty(base, { ...base, orden: "abc" }), {});
  assert.deepEqual(payloadBulkDirty(base, { ...base, orden: "" }), {});
  assert.deepEqual(payloadBulkDirty(base, { ...base, orden: "7" }), { orden: 7 });
});

test("nombre vaciado NO viaja (no se puede borrar el nombre en bloque)", () => {
  assert.deepEqual(payloadBulkDirty(base, { ...base, nombre: "  " }), {});
});

test("booleanos solo cuando cambian", () => {
  assert.deepEqual(payloadBulkDirty(base, { ...base, requiereTecnico: true }), {
    requiereTecnico: true,
  });
});
