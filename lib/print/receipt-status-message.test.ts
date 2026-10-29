import { test } from "node:test";
import assert from "node:assert/strict";

import { RECEIPT_STATUS_MESSAGE, receiptStatusMessage } from "./receipt-status-message.ts";

test("ready: tagged with the shared type, no message field", () => {
  assert.deepEqual(receiptStatusMessage("ready"), { type: RECEIPT_STATUS_MESSAGE, status: "ready" });
});

test("error: carries the reason for the dialog to show", () => {
  assert.deepEqual(receiptStatusMessage("error", "FACTURA_NO_EXISTE · Not found"), {
    type: RECEIPT_STATUS_MESSAGE,
    status: "error",
    message: "FACTURA_NO_EXISTE · Not found",
  });
});

test("error without a reason still reports the failure (the dialog shows its generic text)", () => {
  assert.deepEqual(receiptStatusMessage("error"), { type: RECEIPT_STATUS_MESSAGE, status: "error" });
});
