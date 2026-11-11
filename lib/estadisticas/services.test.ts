import { test } from "node:test";
import assert from "node:assert/strict";

import { hasVitals, showTherapies } from "./services.ts";

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
