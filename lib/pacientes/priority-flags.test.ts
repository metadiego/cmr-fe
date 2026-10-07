import test from "node:test";
import assert from "node:assert/strict";
import { resolvePriorityFlagIcon, resolvePriorityFlagColorClass } from "./priority-flags.ts";
import { LungsIcon, Alert02Icon } from "@hugeicons/core-free-icons";

test("resolvePriorityFlagIcon: clave conocida resuelve su ícono", () => {
  assert.equal(resolvePriorityFlagIcon("oxygen"), LungsIcon);
});

test("resolvePriorityFlagIcon: clave desconocida o ausente cae al genérico, nunca vacío", () => {
  assert.equal(resolvePriorityFlagIcon("algo-que-no-existe"), Alert02Icon);
  assert.equal(resolvePriorityFlagIcon(null), Alert02Icon);
  assert.equal(resolvePriorityFlagIcon(undefined), Alert02Icon);
});

test("resolvePriorityFlagColorClass: clave conocida trae sus clases", () => {
  assert.match(resolvePriorityFlagColorClass("red"), /destructive/);
});

test("resolvePriorityFlagColorClass: clave desconocida o ausente cae a gris, nunca undefined", () => {
  assert.equal(resolvePriorityFlagColorClass("inventado"), resolvePriorityFlagColorClass("gray"));
  assert.equal(resolvePriorityFlagColorClass(null), resolvePriorityFlagColorClass("gray"));
});
