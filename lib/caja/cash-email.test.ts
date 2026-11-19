import { test } from "node:test";
import assert from "node:assert/strict";

import { cashEmailFailure, parseRecipients, readDefaultRecipients, withDefaultRecipients } from "./cash-email.ts";

test("recipients: any separator, de-duplicated, invalid pieces kept apart", () => {
  assert.deepEqual(parseRecipients(" A@x.com, b@y.com;\nfoo  a@x.com "), { emails: ["a@x.com", "b@y.com"], invalid: ["foo"] });
  assert.deepEqual(parseRecipients(""), { emails: [], invalid: [] });
});

test("BE outcomes map to the right message, never to «sent»", () => {
  assert.equal(cashEmailFailure({ code: "MAIL_NOT_CONFIGURED", status: 503 }), "notConfigured");
  assert.equal(cashEmailFailure({ code: "MAIL_NOT_SENT", status: 502 }), "notSent");
  assert.equal(cashEmailFailure({ code: "BAD_REQUEST", status: 400 }), "noRecipients");
  assert.equal(cashEmailFailure({ code: "X", status: 500 }), "other");
});

test("center default list is read and merged without touching the rest of the config", () => {
  assert.deepEqual(readDefaultRecipients({ caja: { emailRecipients: ["a@x.com", 3] } }), ["a@x.com"]);
  assert.deepEqual(readDefaultRecipients(null), []);
  const merged = withDefaultRecipients({ colors: { primary: "#000" }, caja: { other: 1 } } as Record<string, unknown>, ["b@y.com"]);
  assert.deepEqual(merged, { colors: { primary: "#000" }, caja: { other: 1, emailRecipients: ["b@y.com"] } });
});
