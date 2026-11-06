import { test } from "node:test";
import assert from "node:assert/strict";

import { splitInlineFields, chunkPairs } from "./inline-fields.ts";

const f = (clave: string) => ({ clave });
const fields = ["fecha", "paciente", "hora_entrada", "hora_salida", "sesion", "record"].map(f);

test("inline fields follow the configured order; the rest keep theirs", () => {
  const { inline, rest } = splitInlineFields(fields, ["paciente", "record", "sesion", "fecha"]);
  assert.deepEqual(inline.map((x) => x.clave), ["paciente", "record", "sesion", "fecha"]);
  assert.deepEqual(rest.map((x) => x.clave), ["hora_entrada", "hora_salida"]);
});

test("no key configured: header unchanged, one field per line", () => {
  assert.deepEqual(splitInlineFields(fields, undefined), { inline: [], rest: fields });
  assert.deepEqual(splitInlineFields(fields, []), { inline: [], rest: fields });
});

test("unknown keys are skipped, never invented", () => {
  const { inline, rest } = splitInlineFields(fields, ["record", "nope"]);
  assert.deepEqual(inline.map((x) => x.clave), ["record"]);
  assert.equal(rest.length, 5);
});

test("chunkPairs: one row per 2 consecutive fields, in order", () => {
  assert.deepEqual(
    chunkPairs(fields).map((p) => p.map((x) => x.clave)),
    [["fecha", "paciente"], ["hora_entrada", "hora_salida"], ["sesion", "record"]],
  );
});

test("chunkPairs: an odd count leaves a single-field last row, not dropped", () => {
  const odd = fields.slice(0, 5);
  const rows = chunkPairs(odd);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[2].map((x) => x.clave), ["sesion"]);
});
