// "Who did it" is the PERSON (staff id) since the move to the new Supabase project: invoices,
// payments, cash reconciliations, the cashier roster and calendar events all come back with the
// staff id. Comparing them against the login id or the profile id never matches again.
// See docs/specs/who-did-it-is-the-staff-id.md.
import test from "node:test";
import assert from "node:assert/strict";
import { isMine, myStaffId } from "./who-did-it.ts";

const me = { id: "login-1", profileId: "profile-1", staffId: "staff-1" };

test("my id for 'who did it' is my staff id", () => {
  assert.equal(myStaffId(me), "staff-1");
});

test("a login without a staff record has no 'who' id", () => {
  assert.equal(myStaffId({ ...me, staffId: null }), null);
  assert.equal(myStaffId({ ...me, staffId: undefined }), null);
  assert.equal(myStaffId(null), null);
});

test("a row is mine only when its 'who' is my staff id", () => {
  assert.equal(isMine("staff-1", me), true);
  assert.equal(isMine("login-1", me), false);
  assert.equal(isMine("profile-1", me), false);
  assert.equal(isMine("staff-2", me), false);
});

test("no author, or no staff record, is never mine", () => {
  assert.equal(isMine(null, me), false);
  assert.equal(isMine(undefined, me), false);
  assert.equal(isMine(null, { ...me, staffId: null }), false);
});
