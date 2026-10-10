import { test } from "node:test";
import assert from "node:assert/strict";
import { flowColumns, plainColumns, renderColumns } from "./board-columns.ts";

const col = (clave: string, orden: number, tipo = "text", group?: string) => ({ clave, orden, tipo, render: group ? { group } : null });

const laser = [
  col("fd_paciente", 1),
  col("fd_presente", 3, "toggle", "flujo_servicio"),
  col("fd_dosis", 2, "select"),
  col("fd_asistido", 5, "toggle", "flujo_servicio"),
  col("fd_acciones", 9),
  col("fd_notas", 6),
];

test("grouped toggles collapse into one flow cell where the group starts", () => {
  assert.deepEqual(
    renderColumns(laser).map((i) => (i.kind === "flujo" ? "FLOW" : i.col.clave)),
    ["fd_paciente", "fd_dosis", "FLOW", "fd_notas"],
  );
});

test("flow steps and plain columns, each in order; actions never a plain column", () => {
  assert.deepEqual(flowColumns(laser).map((c) => c.clave), ["fd_presente", "fd_asistido"]);
  assert.deepEqual(plainColumns(laser).map((c) => c.clave), ["fd_paciente", "fd_dosis", "fd_notas"]);
});

test("a board with no toggles gets the flow at the end", () => {
  assert.deepEqual(renderColumns([col("a", 2), col("b", 1)]).map((i) => (i.kind === "flujo" ? "FLOW" : i.col.clave)), ["b", "a", "FLOW"]);
});

test("loose toggles already carry the flow: no extra cell", () => {
  assert.deepEqual(renderColumns([col("a", 1), col("t", 2, "toggle")]).map((i) => (i.kind === "flujo" ? "FLOW" : i.col.clave)), ["a", "t"]);
});
