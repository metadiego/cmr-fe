import { test } from "node:test";
import assert from "node:assert/strict";

import { dailyRowShowsUnits, hasVitals, showTherapies } from "./services.ts";

test("laser (Caguas, August): areas differ from visits → «Terapias» shows", () => {
  assert.equal(showTherapies([{ participaciones: 145, therapies: 561 }, { participaciones: 139, therapies: 558 }]), true);
});

test("a service with one therapy per visit, or an older BE without therapies → no column", () => {
  assert.equal(showTherapies([{ participaciones: 12, therapies: 12 }]), false);
  assert.equal(showTherapies([{ participaciones: 12 }]), false);
});

test("Vitales tab only with rows", () => {
  assert.equal(hasVitals({ rows: [{}] }), true);
  assert.equal(hasVitals({ rows: [] }), false);
  assert.equal(hasVitals(undefined), false);
});

test("daily row: Vit C with one vial of 2 → shows visits AND units", () => {
  assert.equal(dailyRowShowsUnits({ visits: 19, therapies: 20 }), true);
});

test("daily row: 1 unit per visit (most services) → the number alone", () => {
  assert.equal(dailyRowShowsUnits({ visits: 12, therapies: 12 }), false);
});
