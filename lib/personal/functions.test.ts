// lib/personal/functions.ts. Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import {
  functionLabel,
  functionsBody,
  groupFunctions,
  holdsFunction,
  offeredFunctions,
  sameFunctions,
  toggleFunction,
} from "./functions.ts";
import type { CatalogFunction } from "../api/functions.ts";
import type { Translator } from "./positions.ts";

const fn = (slug: string, kind: "service" | "task", over: Partial<CatalogFunction> = {}): CatalogFunction => ({
  slug, kind, name: slug.toUpperCase(), labelKey: null, serviceSlug: kind === "service" ? slug : null,
  place: "in_person", active: true, sortOrder: 0, ...over,
});

const t = (keys: Record<string, string>): Translator => Object.assign((k: string) => keys[k] ?? k, { has: (k: string) => k in keys });

test("label: the labelKey when it is translated, else the name", () => {
  const tr = t({ "functions.doctor": "Médico" });
  assert.equal(functionLabel({ labelKey: "functions.doctor", name: "Doctor" }, tr), "Médico");
  assert.equal(functionLabel({ labelKey: null, name: "Láser" }, tr), "Láser");
  assert.equal(functionLabel({ labelKey: "functions.missing", name: "X" }, tr), "X");
});

test("offered: active ones plus inactive ones the person already holds", () => {
  const catalog = [fn("a", "task"), fn("b", "task", { active: false }), fn("c", "task", { active: false })];
  assert.deepEqual(offeredFunctions(catalog, ["c"]).map((f) => f.slug), ["a", "c"]);
});

test("group: services and tasks, each in sortOrder then slug", () => {
  const catalog = [
    fn("z", "task", { sortOrder: 1 }), fn("laser", "service", { sortOrder: 2 }),
    fn("a", "task", { sortOrder: 1 }), fn("iv", "service", { sortOrder: 1 }), fn("first", "task", { sortOrder: 0 }),
  ];
  const g = groupFunctions(catalog);
  assert.deepEqual(g.services.map((f) => f.slug), ["iv", "laser"]);
  assert.deepEqual(g.tasks.map((f) => f.slug), ["first", "a", "z"]);
});

test("toggle adds and removes without duplicates; body is the sorted complete list", () => {
  assert.deepEqual(toggleFunction(["b"], "a"), ["b", "a"]);
  assert.deepEqual(toggleFunction(["b", "a"], "b"), ["a"]);
  assert.deepEqual(functionsBody(["b", "a", "a"]), { functions: ["a", "b"] });
});

test("sameFunctions ignores order", () => {
  assert.equal(sameFunctions(["a", "b"], ["b", "a"]), true);
  assert.equal(sameFunctions(["a"], ["a", "b"]), false);
});

test("holdsFunction reads the held list", () => {
  assert.equal(holdsFunction([{ slug: "doctor" }], "doctor"), true);
  assert.equal(holdsFunction([], "doctor"), false);
  assert.equal(holdsFunction(null, "doctor"), false);
});
