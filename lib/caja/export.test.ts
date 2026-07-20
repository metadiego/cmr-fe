import test from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./export.ts";

test("toCsv serializa filas con CRLF", () => {
  assert.equal(toCsv([["a", "b"], ["c", "d"]]), "a,b\r\nc,d");
});

test("toCsv entrecomilla celdas con coma, comillas o saltos y duplica comillas", () => {
  assert.equal(
    toCsv([["x,y", 'a"b', "l1\nl2"]]),
    '"x,y","a""b","l1\nl2"',
  );
});

test("toCsv acepta números y vacíos", () => {
  assert.equal(toCsv([["Total", 90.5], ["", 0]]), "Total,90.5\r\n,0");
});
