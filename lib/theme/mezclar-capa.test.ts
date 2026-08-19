import { test } from "node:test";
import assert from "node:assert/strict";

import { mezclarSoloTema, type SobreDeCapa } from "./mezclar-capa.ts";

// El `config` de una capa de preferencias es un sobre LIBRE: además del tema lleva ajustes de negocio
// (la capa `centro` de Caguas guarda `facturacion.exigirCobroAntesDeEmitir`). Guardar la apariencia tiene
// que conservar todo lo demás; pisar el sobre entero rompería la facturación de ese centro.
// See docs/specs/apariencia-personal-en-el-avatar-y-corporativa-en-configuracion.md

test("conserva las claves ajenas al tema (los ajustes de negocio del centro)", () => {
  const original: SobreDeCapa = {
    facturacion: { exigirCobroAntesDeEmitir: true },
    colors: { background: "#111111" },
  };
  const r = mezclarSoloTema(original, { colors: { background: "#2e408c" } });
  assert.deepEqual(r.facturacion, { exigirCobroAntesDeEmitir: true });
  assert.deepEqual(r.colors, { background: "#2e408c" });
});

test("escribe las claves de tema que trae lo editado", () => {
  const r = mezclarSoloTema(
    { colors: { background: "#000" }, radius: "0rem" },
    { colors: { background: "#fff" }, radius: "1rem" },
  );
  assert.equal(r.radius, "1rem");
  assert.deepEqual(r.colors, { background: "#fff" });
});

test("una clave de tema que lo editado NO trae se queda como estaba", () => {
  const r = mezclarSoloTema({ radius: "0.625rem" }, { colors: { background: "#fff" } });
  assert.equal(r.radius, "0.625rem");
});

test("sin sobre original devuelve solo el tema, sin inventar nada", () => {
  const r = mezclarSoloTema(null, { colors: { background: "#fff" } });
  assert.deepEqual(r, { colors: { background: "#fff" } });
});

test("no arrastra claves que no son de tema desde lo editado", () => {
  const r = mezclarSoloTema({}, {
    colors: { background: "#fff" },
    facturacion: { exigirCobroAntesDeEmitir: false },
  } as SobreDeCapa);
  assert.equal("facturacion" in r, false);
});
