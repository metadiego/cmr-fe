// The day view opened on "all centers" for EVERY user. Only admin/master may see
// the combined scope (the option is already hidden for the rest), so a non-admin
// landed with an unusable value: a blank picker, a 409 snapshot and a stream that
// reconnected for ever. See docs/specs/be-sse-acotado-al-centro-handoff.md.
import test from "node:test";
import assert from "node:assert/strict";
import { ALL_CENTERS, initialAgendaCenter } from "./initial-center.ts";

const centers = ["bayamon", "caguas"];

test("admin/master: combined by default", () => {
  assert.equal(
    initialAgendaCenter({ canSeeAllCenters: true, saved: null, activeCenter: null, centers }),
    ALL_CENTERS,
  );
});

test("admin/master: a saved choice wins over the default", () => {
  assert.equal(
    initialAgendaCenter({ canSeeAllCenters: true, saved: "caguas", activeCenter: null, centers }),
    "caguas",
  );
});

test("non-admin NEVER lands on the combined scope, even if it was saved", () => {
  assert.equal(
    initialAgendaCenter({
      canSeeAllCenters: false,
      saved: ALL_CENTERS,
      activeCenter: "bayamon",
      centers,
    }),
    "bayamon",
  );
});

test("non-admin: the saved center wins, then the session's active center", () => {
  assert.equal(
    initialAgendaCenter({ canSeeAllCenters: false, saved: "caguas", activeCenter: "bayamon", centers }),
    "caguas",
  );
  assert.equal(
    initialAgendaCenter({ canSeeAllCenters: false, saved: null, activeCenter: "bayamon", centers }),
    "bayamon",
  );
});

test("a center that is no longer assigned is ignored, not carried over", () => {
  assert.equal(
    initialAgendaCenter({ canSeeAllCenters: false, saved: "ponce", activeCenter: "ponce", centers }),
    null,
  );
});

test("a single assigned center needs no choosing", () => {
  assert.equal(
    initialAgendaCenter({
      canSeeAllCenters: false,
      saved: null,
      activeCenter: null,
      centers: ["bayamon"],
    }),
    "bayamon",
  );
});

test("several centers and nothing chosen yet: null, so the user picks one", () => {
  assert.equal(
    initialAgendaCenter({ canSeeAllCenters: false, saved: null, activeCenter: null, centers }),
    null,
  );
});

test("no centers loaded yet: null, never a guess", () => {
  assert.equal(
    initialAgendaCenter({ canSeeAllCenters: false, saved: "bayamon", activeCenter: null, centers: [] }),
    null,
  );
});
