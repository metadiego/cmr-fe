import { test } from "node:test";
import assert from "node:assert/strict";

import { CONSULTATION_BOARD, FRONTDESK_CHANNEL, frontdeskChannel, isConsultationBoard } from "./consultation-board.ts";

test("the Consulta tab is found with the old and the new board key", () => {
  assert.equal(isConsultationBoard("atencion"), true, "old name, still accepted");
  assert.equal(isConsultationBoard("frontdesk_consultation"), true);
  assert.equal(isConsultationBoard("servicios"), false);
  assert.equal(isConsultationBoard(undefined), false);
});

test("requests send the new names (cmr-be #557 is live)", () => {
  assert.equal(CONSULTATION_BOARD, "frontdesk_consultation");
  assert.equal(FRONTDESK_CHANNEL, "frontdesk");
});

test("the old front-desk channel is handled as the new one", () => {
  assert.equal(frontdeskChannel("atencion"), "frontdesk");
  assert.equal(frontdeskChannel("frontdesk"), "frontdesk");
  assert.equal(frontdeskChannel("callcenter"), "callcenter");
  assert.equal(frontdeskChannel(null), null);
});
