import { test } from "node:test";
import assert from "node:assert/strict";

import { CONSULTATION_BOARD, FRONTDESK_CHANNEL, frontdeskChannel, isConsultationBoard } from "./consultation-board.ts";

test("the Consulta tab is found with the old and the new board key", () => {
  assert.equal(isConsultationBoard("atencion"), true, "before cmr-be #557");
  assert.equal(isConsultationBoard("frontdesk_consultation"), true, "after cmr-be #557");
  assert.equal(isConsultationBoard("servicios"), false);
  assert.equal(isConsultationBoard(undefined), false);
});

test("requests keep the old names, the only ones the backend knows before the release", () => {
  assert.equal(CONSULTATION_BOARD, "atencion");
  assert.equal(FRONTDESK_CHANNEL, "atencion");
});

test("the new front-desk channel is handled as the old one", () => {
  assert.equal(frontdeskChannel("frontdesk"), "atencion");
  assert.equal(frontdeskChannel("atencion"), "atencion");
  assert.equal(frontdeskChannel("callcenter"), "callcenter");
  assert.equal(frontdeskChannel(null), null);
});
