import test from "node:test";
import assert from "node:assert/strict";
import { claveUbicacion, fechaDesdeValida } from "./ubicacion.ts";

test("claveUbicacion: vitales siempre es vitales, sin importar el status", () => {
  assert.equal(claveUbicacion({ location: "vitales", status: "presente" }), "enVitales");
  assert.equal(claveUbicacion({ location: "vitales", status: "triage" }), "enVitales");
});

test("claveUbicacion: consulta distingue esperando de siendo atendido", () => {
  assert.equal(claveUbicacion({ location: "consulta", status: "presente" }), "enConsultaEsperando");
  assert.equal(claveUbicacion({ location: "consulta", status: "en_consulta" }), "enConsulta");
});

test("claveUbicacion: servicio distingue esperando de en terapia", () => {
  assert.equal(claveUbicacion({ location: "servicio", status: "presente" }), "enServicioEsperando");
  assert.equal(claveUbicacion({ location: "servicio", status: "en_terapia" }), "enServicio");
});

test("fechaDesdeValida: rechaza el epoch sucio (bug conocido de citas viejas)", () => {
  assert.equal(fechaDesdeValida("1970-01-01T00:00:00.000Z"), false);
});

test("fechaDesdeValida: acepta una fecha real", () => {
  assert.equal(fechaDesdeValida("2026-10-07T13:22:12.100Z"), true);
});

test("fechaDesdeValida: rechaza texto inválido sin tirar", () => {
  assert.equal(fechaDesdeValida("no-es-fecha"), false);
});
