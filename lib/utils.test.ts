import { test } from "node:test";
import assert from "node:assert/strict";

import { safeInternalPath } from "./utils.ts";

test("safeInternalPath: ruta propia relativa se acepta tal cual", () => {
  assert.equal(safeInternalPath("/boards/frontdesk?tab=consulta"), "/boards/frontdesk?tab=consulta");
});

test("safeInternalPath: URL absoluta se rechaza (open redirect)", () => {
  assert.equal(safeInternalPath("https://evil.com"), null);
});

test("safeInternalPath: protocolo-relativa se rechaza (//evil.com)", () => {
  assert.equal(safeInternalPath("//evil.com"), null);
});

test("safeInternalPath: vacío, null o undefined se rechazan", () => {
  assert.equal(safeInternalPath(""), null);
  assert.equal(safeInternalPath(null), null);
  assert.equal(safeInternalPath(undefined), null);
});
