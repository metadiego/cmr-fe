import { test } from "node:test";
import assert from "node:assert/strict";

import { splitInlineFields } from "./inline-fields.ts";

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
