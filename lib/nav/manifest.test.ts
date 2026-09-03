import { test } from "node:test";
import assert from "node:assert/strict";

import {
  routeForClave,
  NAV_MANIFEST,
  NAV_GROUPS,
  groupForClave,
  orderForClave,
} from "./manifest.ts";

// Rule 1: a known clave resolves to its manifest route (ignores bePath).
test("known clave resolves to its manifest route", () => {
  assert.equal(routeForClave("citas", "/ignored"), "/scheduling/appointments");
  assert.equal(routeForClave("inventario-existencias", undefined), "/inventory/stock");
});

// Deliberate fix: cambio-de-protocolo points at the WORKING FE folder, not the
// broken BE seed path (/pacientes/cambio-de-protocolo 404s today).
test("cambio-de-protocolo resolves to its FE route (also fixes the old BE-seed 404)", () => {
  assert.equal(routeForClave("cambio-de-protocolo", "/pacientes/cambio-de-protocolo"), "/patients/protocol-change");
});

// Rule 2: an UNKNOWN clave whose BE path is a dynamic board → /boards/ rewrite.
test("unknown /tablero/* clave is rewritten to /boards/*", () => {
  assert.equal(routeForClave("operaciones", "/tablero/operaciones"), "/boards/operaciones");
  assert.equal(routeForClave("some-new-board", "/tablero/foo"), "/boards/foo");
});

// Rule 3: unknown clave, non-board path → returned verbatim (never a dead link
// for a future BE item the FE doesn't know yet).
test("unknown clave falls back to the BE path verbatim", () => {
  assert.equal(routeForClave("future-thing", "/whatever"), "/whatever");
});

// Rule 3 edge: unknown clave, no bePath → safe non-navigating "#".
test("unknown clave with no bePath returns '#'", () => {
  assert.equal(routeForClave("nope", undefined), "#");
});

// Manifest contract: every seeded clave (from cmr-be/src/scripts/menu-items.ts)
// resolves to its FE route. Billing/reports rows are English (Phase 1); the rest
// remain at their pre-rename paths until their category's PR lands.
test("seeded claves resolve to their FE route", () => {
  const SEED: Array<[string, string]> = [
    ["citas", "/scheduling/appointments"],
    ["cupos", "/scheduling/slots"],
    ["calendario", "/scheduling/calendar"],
    ["atencion", "/boards/atencion"],
    ["clientes", "/patients"],
    ["comunicaciones", "/communications"],
    ["facturacion", "/billing/invoices"],
    ["consultas", "/billing/consultations"],
    ["grupos-facturacion", "/billing/groups"],
    ["facturacion-devoluciones", "/billing/returns"],
    ["consultas-devoluciones", "/billing/consultations/returns"],
    ["consumo-insumos", "/reports/supply-consumption"],
    ["caja-consulta", "/billing/cash/consultation"],
    ["caja-general", "/billing/cash/general"],
    ["precios", "/inventory/prices"],
    ["frontdesk", "/boards/frontdesk"],
    ["servicios", "/boards/servicios"],
    ["panel-enfermeria", "/services/nursing-panel"],
    ["config-formatos", "/configuration/formats"],
    ["estadisticas-servicios", "/reports/services"],
    ["ventas-por-grupo", "/reports/sales-by-group"],
    ["ventas-por-usuario", "/reports/sales-by-user"],
    ["estadisticas-diarias", "/reports/daily"],
    ["inventario-index", "/inventory"],
    ["inventario-existencias", "/inventory/stock"],
    ["inventario-viales", "/inventory/vials"],
    ["inventario-productos", "/inventory/products"],
    ["inventario-proveedores", "/inventory/suppliers"],
    ["inventario-amp", "/inventory/supplier-presentations"],
    ["inventario-recibir", "/inventory/receive-purchase"],
    ["inventario-recetas", "/inventory/recipes"],
    ["inventario-transferencias", "/inventory/transfers"],
    ["configuracion-tableros", "/configuration/boards"],
    ["configuracion-modulos", "/configuration/board-modules"],
    ["servicios-config", "/configuration/services"],
    ["config-factura", "/configuration/invoice"],
    ["config-requeridos", "/configuration/required-fields"],
    ["config-datos-paciente", "/configuration/patient-fields"],
    ["configuracion-apariencia", "/configuration/appearance"],
    ["admin", "/admin"],
    ["personal", "/configuration/staff"],
    ["auditoria", "/configuration/audit"],
    ["home", "/"],
    ["dashboard", "/dashboard"],
  ];
  // Every seeded MANIFEST clave ignores bePath (rule 1), so the sentinel proves
  // the resolved route comes from the manifest, not the BE path. (The /tablero→
  // /boards rewrite for non-manifest boards like `operaciones` is tested above.)
  for (const [clave, expected] of SEED) {
    assert.equal(routeForClave(clave, "/SENTINEL_BE_PATH"), expected, `clave ${clave}`);
  }
});

// ---- Phase 2: FE-owned groups --------------------------------------------

test("every manifest entry declares a valid group", () => {
  const valid = new Set(NAV_GROUPS.map((g) => g.key));
  for (const e of NAV_MANIFEST) {
    assert.ok(valid.has(e.group), `${e.clave} has invalid group ${e.group}`);
  }
});

test("groupForClave / orderForClave resolve known claves", () => {
  assert.equal(groupForClave("facturacion"), "billing");
  assert.equal(groupForClave("inventario-existencias"), "inventory");
  assert.equal(groupForClave("personal"), "configuration"); // staff folded in (decision #5)
  assert.equal(groupForClave("admin"), "admin"); // top-level (decision #1)
  assert.equal(typeof orderForClave("facturacion"), "number");
});

test("unknown clave has no group and sorts last", () => {
  assert.equal(groupForClave("operaciones"), undefined);
  assert.equal(orderForClave("operaciones"), Number.MAX_SAFE_INTEGER);
});

test("NAV_GROUPS is the 9-group taxonomy in order", () => {
  assert.deepEqual(
    NAV_GROUPS.map((g) => g.key),
    ["scheduling", "patients", "services", "billing", "reports", "inventory", "communications", "admin", "configuration"],
  );
});
