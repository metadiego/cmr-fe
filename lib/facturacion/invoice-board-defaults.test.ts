import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_INVOICE_COLUMNS, invoiceColumnShape } from "./invoice-board-defaults.ts";

test("standard invoice columns keep the board order and have unique keys", () => {
  assert.deepEqual(
    DEFAULT_INVOICE_COLUMNS.map((c) => c.clave),
    ["fac_numero", "fac_fecha", "fac_paciente", "fac_medico", "fac_usuario", "fac_estado", "fac_total", "fac_medio"],
  );
  assert.ok(DEFAULT_INVOICE_COLUMNS.every((c) => c.labelKey === `fac.col.${c.clave.slice(4)}`));
});

test("invoiceColumnShape falls back to text for custom columns", () => {
  assert.equal(invoiceColumnShape("fac_paciente"), "long");
  assert.equal(invoiceColumnShape("fac_estado"), "badge");
  assert.equal(invoiceColumnShape("fac_custom"), "text");
});
