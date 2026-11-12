import { test } from "node:test";
import assert from "node:assert/strict";

import { conteoTableHtml } from "./conteo-table-print.ts";

const labels = {
  colCantidad: "Cantidad",
  colValor: "Valor",
  colMonto: "Monto",
  conteoTotal: "Total contado",
  sinConteo: "Sin conteo todavía",
};

test("sin conteo (total null): dice 'sin conteo', no tabla de líneas", () => {
  const html = conteoTableHtml({ title: "Consulta", lines: [], total: null, labels });
  assert.match(html, /Sin conteo todavía/);
  assert.doesNotMatch(html, /<table/);
});

test("con líneas: ordena de mayor a menor valor y pone el total", () => {
  const html = conteoTableHtml({
    title: "General",
    lines: [
      { key: "10", quantity: 2, value: 10, amount: 20 },
      { key: "20", quantity: 1, value: 20, amount: 20 },
    ],
    total: 40,
    labels,
  });
  const i20 = html.indexOf("$20.00");
  const i10 = html.indexOf("$10.00");
  assert.ok(i20 > -1 && i10 > -1 && i20 < i10, "el valor $20 debe salir antes que el $10");
  assert.match(html, /\$40\.00/); // total
});

test("sin líneas pero total 0 (conteo real de cero): muestra la tabla vacía, no 'sin conteo'", () => {
  const html = conteoTableHtml({ title: "Consulta", lines: [], total: 0, labels });
  assert.match(html, /<table/);
});
