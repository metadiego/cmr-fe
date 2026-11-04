import { test } from "node:test";
import assert from "node:assert/strict";

import { consolidatedCount } from "./consolidated-count.ts";

const ana = { userId: "ana", conteo: [{ denominationId: "20", quantity: 3 }] };
const luis = { userId: "luis", conteo: [{ denominationId: "20", quantity: 1 }, { denominationId: "5", quantity: 2 }] };

test("no manager count: the consolidated is the sum of the cashiers", () => {
  const r = consolidatedCount([ana, luis]);
  assert.equal(r.manager, null);
  assert.equal(r.managerCounted, false);
  assert.deepEqual(r.initial, { "20": 4, "5": 2 });
});

test("the manager's own count wins, and is never added into the sum", () => {
  const mgr = { userId: null, conteo: [{ denominationId: "20", quantity: 10 }] };
  const r = consolidatedCount([ana, mgr, luis]);
  assert.equal(r.managerCounted, true);
  assert.deepEqual(r.initial, { "20": 10 });
  assert.deepEqual(r.sum, { "20": 4, "5": 2 });
});

test("a manager cuadre with an empty count goes back to the sum", () => {
  const r = consolidatedCount([ana, { userId: null, conteo: [] }]);
  assert.equal(r.managerCounted, false);
  assert.ok(r.manager);
  assert.deepEqual(r.initial, { "20": 3 });
});
