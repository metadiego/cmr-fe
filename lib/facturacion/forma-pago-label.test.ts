// La forma de pago que se IMPRIME en el recibo. Correr: `npm test`.
//
// El catálogo del backend guarda el nombre en español; la pantalla lo traduce por `clave`. Si esto
// falla, el recibo de un usuario en inglés dice «Efectivo», o peor, «—» donde había un pago.
import test from "node:test";
import assert from "node:assert/strict";
import { formaPagoLabel } from "./forma-pago-label.ts";

// Doble del traductor: `has` dice si la clave existe, `t` la resuelve.
const traductor = (dic: Record<string, string>) =>
  Object.assign((k: string) => dic[k] ?? k, { has: (k: string) => k in dic }) as never;

const T = traductor({ "formasPago.efectivo": "Cash", "formasPago.tarjeta": "Card" });

test("traduce por CLAVE, no por el nombre en español del catálogo", () => {
  assert.equal(formaPagoLabel(T, "efectivo", "Efectivo"), "Cash");
});

test("una forma personalizada del centro se imprime tal cual, sin traducir", () => {
  // «Care Credit» o «Deducible (seguro)» no están en el diccionario y no deben desaparecer.
  assert.equal(formaPagoLabel(T, "care_credit", "Care Credit"), "Care Credit");
});

test("sin clave se usa el nombre del catálogo", () => {
  assert.equal(formaPagoLabel(T, null, "Cheque"), "Cheque");
  assert.equal(formaPagoLabel(T, undefined, "ATH"), "ATH");
});

test("sin clave y sin nombre imprime la raya, nunca «undefined»", () => {
  assert.equal(formaPagoLabel(T, null, null), "—");
  assert.equal(formaPagoLabel(T, undefined, undefined), "—");
});

test("la clave manda sobre el nombre cuando existe traducción", () => {
  assert.equal(formaPagoLabel(T, "tarjeta", "Tarjeta de crédito"), "Card");
});
