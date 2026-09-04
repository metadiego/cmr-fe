// QUIÉN VE QUÉ. Correr: `npm test`.
//
// Desde el 2-sep-2026 el FRONTEND decide la visibilidad del menú (el backend sigue protegiendo lo
// que se PUEDE hacer en cada endpoint). O sea que este fichero de 30 líneas es el que decide lo que
// cada persona encuentra al entrar, y no tenía ni un test. Un fallo aquí no da error: simplemente
// alguien deja de ver su trabajo, o lo ve quien no debe.
import test from "node:test";
import assert from "node:assert/strict";
import { canSeeMenuItem, filterMenuByPermissions } from "./menu-access.ts";

const item = (o: Record<string, unknown> = {}) =>
  ({ slug: "x", labelKey: "x", ...o }) as never;

test("un ítem sin permiso declarado lo ve cualquiera que entre", () => {
  assert.equal(canSeeMenuItem(item(), []), true);
});

test("un ítem con permiso solo lo ve quien lo tiene", () => {
  assert.equal(canSeeMenuItem(item({ permissionSlug: "factura.read" }), ["factura.read"]), true);
  assert.equal(canSeeMenuItem(item({ permissionSlug: "factura.read" }), ["caja.read"]), false);
});

test("el master (*) lo ve todo, sin enumerar permisos", () => {
  assert.equal(canSeeMenuItem(item({ permissionSlug: "numeracion.arranque" }), ["*"]), true);
});

test("oculto es oculto, aunque el permiso lo tenga — y aunque sea master", () => {
  // `visible:false` es la decisión del administrador sobre el catálogo; no la pisa un permiso.
  assert.equal(canSeeMenuItem(item({ visible: false, permissionSlug: "factura.read" }), ["factura.read"]), false);
  assert.equal(canSeeMenuItem(item({ visible: false }), ["*"]), false);
});

test("visible undefined NO significa oculto: solo `false` esconde", () => {
  assert.equal(canSeeMenuItem(item({ visible: undefined }), []), true);
});

test("un permiso vacío o nulo se trata como «sin permiso declarado»", () => {
  assert.equal(canSeeMenuItem(item({ permissionSlug: "" }), []), true);
  assert.equal(canSeeMenuItem(item({ permissionSlug: null }), []), true);
});

test("sin permisos, la barra queda solo con lo abierto — no vacía ni completa", () => {
  const menu = [
    item({ slug: "inicio" }),
    item({ slug: "facturacion", permissionSlug: "factura.read" }),
    item({ slug: "numeracion", permissionSlug: "numeracion.arranque" }),
    item({ slug: "interno", visible: false }),
  ];
  assert.deepEqual(
    filterMenuByPermissions(menu, []).map((i) => (i as { slug: string }).slug),
    ["inicio"],
  );
});

test("con el permiso fino, aparece su opción y solo la suya", () => {
  const menu = [
    item({ slug: "facturacion", permissionSlug: "factura.read" }),
    item({ slug: "numeracion", permissionSlug: "numeracion.arranque" }),
  ];
  assert.deepEqual(
    filterMenuByPermissions(menu, ["numeracion.arranque"]).map((i) => (i as { slug: string }).slug),
    ["numeracion"],
  );
});

test("filtrar no muta ni reordena el catálogo que llega del backend", () => {
  const menu = [item({ slug: "a" }), item({ slug: "b" })];
  const copia = [...menu];
  const out = filterMenuByPermissions(menu, ["*"]);
  assert.deepEqual(menu, copia);
  assert.deepEqual(out.map((i) => (i as { slug: string }).slug), ["a", "b"]);
});
