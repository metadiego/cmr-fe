// TDD de los helpers puros de columnas ENCADENADAS por `group` (editor de tableros). Correr: `npm test`
// (node --test --experimental-strip-types, sin dependencias nuevas). Ver .personal/HANDOFF-columnas-encadenadas.
// Regla del negocio (fuente de verdad: BE render.group): columnas contiguas con el MISMO group no-nulo forman
// un bloque que se mueve JUNTO; el orden se persiste contiguo. PROHIBIDO hardcodear claves de grupo.
import test from "node:test";
import assert from "node:assert/strict";
import { toBlocks, moveBlock, flatten, normalize } from "./column-blocks.ts";

type R = { clave: string; group?: string | null };
const rows = (...specs: [string, (string | null)?][]): R[] =>
  specs.map(([clave, group]) => ({ clave, group: group ?? null }));
const claves = (rs: R[]) => rs.map((r) => r.clave).join(",");

test("toBlocks: filas sin grupo son bloques de 1", () => {
  const bs = toBlocks(rows(["a"], ["b"], ["c"]));
  assert.equal(bs.length, 3);
  assert.deepEqual(bs.map((b) => b.items.length), [1, 1, 1]);
  assert.deepEqual(bs.map((b) => b.group), [null, null, null]);
});

test("toBlocks: contiguas con mismo group colapsan en un bloque", () => {
  const bs = toBlocks(rows(["a"], ["p", "g"], ["q", "g"], ["r", "g"], ["b"]));
  assert.equal(bs.length, 3);
  assert.equal(bs[1].group, "g");
  assert.equal(claves(bs[1].items), "p,q,r");
});

test("toBlocks: mismo group NO contiguo = bloques separados (se respeta el dato tal cual)", () => {
  const bs = toBlocks(rows(["p", "g"], ["x"], ["q", "g"]));
  assert.equal(bs.length, 3);
});

test("moveBlock: mover el bloque encadenado lo mueve COMPLETO (baja)", () => {
  const bs = toBlocks(rows(["p", "g"], ["q", "g"], ["z"]));
  const moved = flatten(moveBlock(bs, 0, 1));
  assert.equal(claves(moved), "z,p,q");
});

test("moveBlock: subir un bloque cruza sobre el bloque anterior entero", () => {
  const bs = toBlocks(rows(["z"], ["p", "g"], ["q", "g"]));
  const moved = flatten(moveBlock(bs, 1, -1));
  assert.equal(claves(moved), "p,q,z");
});

test("moveBlock: respeta límites (no-op fuera de rango)", () => {
  const bs = toBlocks(rows(["a"], ["b"]));
  assert.equal(claves(flatten(moveBlock(bs, 0, -1))), "a,b");
  assert.equal(claves(flatten(moveBlock(bs, 1, 1))), "a,b");
});

test("flatten(toBlocks(x)) es identidad en el orden", () => {
  const r = rows(["a"], ["p", "g"], ["q", "g"], ["b"]);
  assert.equal(claves(flatten(toBlocks(r))), claves(r));
});

test("normalize: junta miembros partidos en la 1ª aparición del grupo", () => {
  const r = rows(["p", "g"], ["x"], ["q", "g"], ["y"], ["r", "g"]);
  assert.equal(claves(normalize(r)), "p,q,r,x,y");
});

test("normalize es idempotente", () => {
  const once = normalize(rows(["p", "g"], ["x"], ["q", "g"]));
  const twice = normalize(once);
  assert.equal(claves(once), claves(twice));
});

test("normalize no toca filas sin grupo ni grupos ya contiguos", () => {
  const r = rows(["a"], ["p", "g"], ["q", "g"], ["b"]);
  assert.equal(claves(normalize(r)), "a,p,q,b");
});

test("data-driven: cualquier group nuevo se encadena sin cambiar código", () => {
  const bs = toBlocks(rows(["m", "otro"], ["n", "otro"]));
  assert.equal(bs.length, 1);
  assert.equal(bs[0].group, "otro");
  assert.equal(claves(bs[0].items), "m,n");
});
