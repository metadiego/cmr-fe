// El PAPEL: lo que se imprime y se le entrega a una persona. Correr: `npm test`.
//
// Este fichero existe porque el 3-sep-2026 tres defectos del documento impreso salieron probando a
// mano contra producción, con 3.692 tests del backend en verde: el nombre del paciente llegaba en
// piezas, el recibo de la devolución no decía qué se devolvió, y su número salía sin formatear.
// El armado del recibo en el FE —206 líneas— no tenía ni un test.
import test from "node:test";
import assert from "node:assert/strict";
import { buildRecibo, buildReciboDevolucion } from "./build-recibo.ts";

const EMPRESA = { nombreLegal: "MEDICINA SISTEMICA LLC", logoUrl: null } as never;

const facturaBase = {
  status: "emitida",
  displayNumber: "000325",
  emitidaEn: "2026-09-03",
  subtotal: 305.76,
  discount: 0,
  tax: 35.16,
  total: 340.92,
  paidAmount: 340.92,
  empresa: EMPRESA,
  taxes: [
    { name: "Estatal", rate: 10.5, amount: 32.1 },
    { name: "Municipal", rate: 1, amount: 3.06 },
  ],
  patient: {
    firstName: "ANA AIXA",
    lastName: "OTERO ADORNO",
    displayName: "OTERO ADORNO, ANA AIXA",
    medicalRecordNumber: "102803",
  },
  items: [
    {
      description: "NEURALGAID 300 CAPSULES",
      quantity: 2,
      unitPrice: 152.88,
      discount: 0,
      total: 305.76,
    },
  ],
} as never;

test("el nombre del paciente sale COMPUESTO por el backend, no rearmado aquí", () => {
  const r = buildRecibo(facturaBase);
  assert.equal(r.paciente.nombre, "OTERO ADORNO, ANA AIXA");
  assert.equal(r.paciente.record, "102803");
});

test("si el backend no compone el nombre, el papel no sale vacío", () => {
  const f = { ...(facturaBase as object), patient: { firstName: "ANA AIXA", lastName: "OTERO ADORNO" } } as never;
  assert.equal(buildRecibo(f).paciente.nombre, "ANA AIXA OTERO ADORNO");
});

test("sin paciente no se imprime «null» ni «undefined»", () => {
  const f = { ...(facturaBase as object), patient: null } as never;
  assert.equal(buildRecibo(f).paciente.nombre, "");
});

test("cada línea dice qué es, cuánto y por cuánto", () => {
  const [linea] = buildRecibo(facturaBase).items;
  assert.equal(linea.descripcion, "NEURALGAID 300 CAPSULES");
  assert.equal(linea.cantidad, 2);
  assert.equal(linea.total, 305.76);
});

test("el IVU va DESGLOSADO: Estatal + Municipal, y suma el impuesto de la factura", () => {
  const r = buildRecibo(facturaBase);
  assert.deepEqual(r.impuestos.map((i) => i.nombre), ["Estatal", "Municipal"]);
  // Suma en coma flotante: 32.1 + 3.06 no da exactamente 35.16, y el papel imprime a 2 decimales.
  assert.equal(Number(r.impuestos.reduce((s, i) => s + i.monto, 0).toFixed(2)), 35.16);
  assert.equal(r.impuesto, 35.16);
});

test("un impuesto en 0 SÍ se imprime: su ausencia se leería como error de cálculo", () => {
  const f = { ...(facturaBase as object), taxes: [{ name: "Municipal", amount: 0 }] } as never;
  assert.equal(buildRecibo(f).impuestos.length, 1);
});

test("un borrador es un PRESUPUESTO y usa su propio número", () => {
  const f = { ...(facturaBase as object), status: "borrador", displayNumber: null } as never;
  const r = buildRecibo(f, {}, {}, "P-000007");
  assert.equal(r.tipoDocumento, "presupuesto");
  assert.equal(r.numeroDisplay, "P-000007");
});

test("sin número no se imprime «null»: se imprime la raya", () => {
  const f = { ...(facturaBase as object), displayNumber: null } as never;
  assert.equal(buildRecibo(f).numeroDisplay, "—");
});

test("la cantidad EFECTIVA del láser multiplica áreas por días", () => {
  const f = {
    ...(facturaBase as object),
    items: [{ description: "Láser MLS", quantity: 1, unitPrice: 100, discount: 0, total: 2400, meta: { multiplicadores: { dias: 12, areas: 2 } } }],
  } as never;
  const [linea] = buildRecibo(f).items;
  assert.equal(linea.cantidad, 24);
  assert.deepEqual(linea.multiplicadores, { dias: 12, areas: 2 });
});

// ── El recibo de la DEVOLUCIÓN ────────────────────────────────────────────────────────────────
const devolucionBase = {
  displayNumber: "D-000016",
  date: "2026-09-03",
  status: "activa",
  refundedAmount: 170.46,
  refundedTax: 17.58,
  formaReembolso: "Efectivo",
  empresa: EMPRESA,
  patient: { firstName: "ANA AIXA", lastName: "OTERO ADORNO", displayName: "OTERO ADORNO, ANA AIXA", medicalRecordNumber: "102803" },
  items: [{ invoiceItemId: "li-1", quantity: 1, amount: 170.46, description: "NEURALGAID 300 CAPSULES" }],
} as never;

test("la línea devuelta dice QUÉ se devolvió, con la descripción que manda el backend", () => {
  // Antes decía «1 … 170.46» sin nombrar el producto: el backend no la enviaba y el FE ponía «—».
  const [linea] = buildReciboDevolucion(devolucionBase).items;
  assert.equal(linea.descripcion, "NEURALGAID 300 CAPSULES");
});

test("si el backend no la trae, se usa el mapa de la factura de origen", () => {
  const d = { ...(devolucionBase as object), items: [{ invoiceItemId: "li-1", quantity: 1, amount: 170.46 }] } as never;
  const [linea] = buildReciboDevolucion(d, { "li-1": "NEURALGAID 300 CAPSULES" }).items;
  assert.equal(linea.descripcion, "NEURALGAID 300 CAPSULES");
});

test("el número de la devolución sale formateado del backend, no como entero pelado", () => {
  assert.equal(buildReciboDevolucion(devolucionBase).numeroDisplay, "D-000016");
});

test("la devolución cuadra: subtotal + impuesto = lo devuelto", () => {
  const r = buildReciboDevolucion(devolucionBase);
  assert.equal(r.total, 170.46);
  assert.equal(r.impuesto, 17.58);
  assert.equal(Number((r.subtotal + r.impuesto).toFixed(2)), 170.46);
});

test("el reembolso se muestra como el pago del recibo", () => {
  const r = buildReciboDevolucion(devolucionBase);
  assert.deepEqual(r.pagos.map((p) => [p.formaPagoNombre, p.monto]), [["Efectivo", 170.46]]);
});

test("el paciente del recibo de devolución se compone igual que en la factura", () => {
  assert.equal(
    buildReciboDevolucion(devolucionBase).paciente.nombre,
    buildRecibo(facturaBase).paciente.nombre,
  );
});
