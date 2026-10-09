import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPrinter, printerChoiceKey } from "./printer-choice.ts";

const printers = [
  { id: "p1", name: "Principal" },
  { id: "p2", name: "Facturación" },
];

test("the printer this machine chose, when it still exists", () => {
  assert.equal(pickPrinter(printers, "p2")?.name, "Facturación");
});

test("nothing chosen, or the chosen one was removed → the first printer", () => {
  assert.equal(pickPrinter(printers, null)?.id, "p1");
  assert.equal(pickPrinter(printers, "gone")?.id, "p1");
});

test("a center with no printers → none (the backup button does not show)", () => {
  assert.equal(pickPrinter([], "p1"), null);
});

test("the choice is per center: Caguas and Bayamón do not share it", () => {
  assert.notEqual(printerChoiceKey("cag"), printerChoiceKey("bay"));
});
