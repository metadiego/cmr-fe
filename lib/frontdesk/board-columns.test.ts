import { test } from "node:test";
import assert from "node:assert/strict";
import { flowColumns, plainColumns, renderColumns, sortBoardRowsNatural } from "./board-columns.ts";

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

type Row = { id: string; estado: string; presente?: string | null; asistido?: string | null; time?: string | null };
const opts = {
  estadoOf: (r: Row) => r.estado,
  presenteOf: (r: Row) => r.presente,
  asistidoOf: (r: Row) => r.asistido,
  scheduledTimeOf: (r: Row) => r.time,
};

test("sortBoardRowsNatural: an early-arriving ASISTIDO does not outrank someone still here (found live 12-oct-2026, Vit C)", () => {
  const rows: Row[] = [
    { id: "finished", estado: "asistido", presente: "2026-10-12T11:55:00Z", asistido: "2026-10-12T12:47:00Z" },
    { id: "active", estado: "en_terapia", presente: "2026-10-12T12:20:00Z" },
  ];
  assert.deepEqual(sortBoardRowsNatural(rows, opts).map((r) => r.id), ["active", "finished"]);
});

test("sortBoardRowsNatural: here-now rows (presente/en_terapia) order by arrival, mixed together", () => {
  const rows: Row[] = [
    { id: "b", estado: "presente", presente: "2026-10-12T12:00:00Z" },
    { id: "a", estado: "en_terapia", presente: "2026-10-12T11:00:00Z" },
  ];
  assert.deepEqual(sortBoardRowsNatural(rows, opts).map((r) => r.id), ["a", "b"]);
});

test("sortBoardRowsNatural: pendiente orders by its OWN appointment time, after everyone already here", () => {
  const rows: Row[] = [
    { id: "p2", estado: "pendiente", time: "10:00" },
    { id: "here", estado: "presente", presente: "2026-10-12T12:00:00Z" },
    { id: "p1", estado: "pendiente", time: "09:00" },
  ];
  assert.deepEqual(sortBoardRowsNatural(rows, opts).map((r) => r.id), ["here", "p1", "p2"]);
});

test("sortBoardRowsNatural: cancelada always sinks to the very end", () => {
  const rows: Row[] = [
    { id: "c", estado: "cancelada" },
    { id: "done", estado: "asistido", asistido: "2026-10-12T09:00:00Z" },
    { id: "p", estado: "pendiente", time: "08:00" },
  ];
  assert.deepEqual(sortBoardRowsNatural(rows, opts).map((r) => r.id), ["p", "done", "c"]);
});
