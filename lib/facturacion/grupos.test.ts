import test from "node:test";
import assert from "node:assert/strict";
import { contarPorGrupo, particionarMembresia } from "./grupos.ts";

const P = (id: string, g: string | null) => ({ id, grupoFacturacionId: g });

test("contarPorGrupo cuenta por grupoFacturacionId e ignora los sin grupo", () => {
  const out = contarPorGrupo([P("1", "suero"), P("2", "suero"), P("3", "laser"), P("4", null)]);
  assert.deepEqual(out, { suero: 2, laser: 1 });
});

test("contarPorGrupo con lista vacía = {}", () => {
  assert.deepEqual(contarPorGrupo([]), {});
});

test("particionarMembresia separa miembros del grupo y disponibles", () => {
  const prods = [P("1", "suero"), P("2", "laser"), P("3", null), P("4", "suero")];
  const { miembros, disponibles } = particionarMembresia(prods, "suero");
  assert.deepEqual(miembros.map((p) => p.id), ["1", "4"]);
  assert.deepEqual(disponibles.map((p) => p.id), ["2", "3"]);
});
