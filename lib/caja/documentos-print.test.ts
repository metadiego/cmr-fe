import { test } from "node:test";
import assert from "node:assert/strict";

import { documentosPrintHtml, type DocumentoImpreso } from "./documentos-print.ts";

const L = {
  documentos: "Documentos del día",
  ventaGeneral: "Venta general",
  consultas: "Consultas",
  totalVentaGeneral: "Total venta general",
  totalConsultas: "Total consultas",
  totalGeneralDocumentos: "Total general",
  colNumero: "Nº",
  colRecord: "Récord",
  colPaciente: "Paciente",
  colFacturo: "Facturó",
  colFormaPago: "Forma de pago",
  colTotal: "Total",
};

const doc = (over: Partial<DocumentoImpreso>): DocumentoImpreso => ({
  id: "d1",
  number: "100",
  patient: "Ana Rivera",
  medicalRecordNumber: "R1",
  formaPago: "EF",
  total: 20,
  ...over,
});

test("sin división (una división o un cajero): una sola tabla, con su total al pie", () => {
  const html = documentosPrintHtml([doc({ total: 20 }), doc({ id: "d2", total: 30 })], undefined, L);
  assert.match(html, /Documentos del día \(2\)/);
  assert.doesNotMatch(html, /Venta general/);
  assert.doesNotMatch(html, /Consultas/);
  // Sin `documentosPorDivision` del BE, el total de respaldo es la suma de la lista ($50).
  assert.match(html, /Total<\/td><td class="r mono">\$50\.00/);
});

test("con división: parte en Venta general / Consultas, cada una con SU total, + un total general", () => {
  const documentos = [
    doc({ id: "g1", division: "general", total: 100 }),
    doc({ id: "c1", division: "consulta", total: 25 }),
    doc({ id: "c2", division: "consulta", total: 15 }),
  ];
  const html = documentosPrintHtml(documentos, { general: { count: 1, total: 100 }, consulta: { count: 2, total: 40 }, total: { count: 3, total: 140 } }, L);
  assert.match(html, /Venta general \(1\)/);
  assert.match(html, /Consultas \(2\)/);
  assert.match(html, /Total venta general<\/td><td class="r mono">\$100\.00/);
  assert.match(html, /Total consultas<\/td><td class="r mono">\$40\.00/);
  assert.match(html, /Total general<\/td><td class="r mono">\$140\.00/);
});

test("con división pero SIN documentosPorDivision del BE (respaldo): suma la lista visible, nunca inventa", () => {
  const documentos = [doc({ id: "g1", division: "general", total: 100 }), doc({ id: "c1", division: "consulta", total: 25 })];
  const html = documentosPrintHtml(documentos, undefined, L);
  assert.match(html, /Total venta general<\/td><td class="r mono">\$100\.00/);
  assert.match(html, /Total consultas<\/td><td class="r mono">\$25\.00/);
  assert.match(html, /Total general<\/td><td class="r mono">\$125\.00/);
});

test("una división vacía (p. ej. nadie facturó en consulta hoy): tabla vacía, total $0.00, no se cae", () => {
  const documentos = [doc({ id: "g1", division: "general", total: 50 })];
  const html = documentosPrintHtml(documentos, { general: { count: 1, total: 50 }, consulta: { count: 0, total: 0 }, total: { count: 1, total: 50 } }, L);
  assert.match(html, /Consultas \(0\)/);
  assert.match(html, /Total consultas<\/td><td class="r mono">\$0\.00/);
});
