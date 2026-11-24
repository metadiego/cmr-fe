import { test } from "node:test";
import assert from "node:assert/strict";

import { groupOverdue, type OverdueVisit } from "./overdue-visits.ts";

const v = (key: string, date: string, kind: OverdueVisit["kind"] = "services"): OverdueVisit => ({ key, kind, date, patientId: `p-${key}`, patientName: key });

test("overdue visits group by who left them, most first, oldest day first; no actor → left out", () => {
  const groups = groupOverdue(
    [
      { actorId: "yadira", visit: v("b", "2026-11-21") },
      { actorId: "ana", actorName: "ANA", visit: v("c", "2026-11-20", "consultation") },
      { actorId: "yadira", visit: v("a", "2026-11-19") },
      { actorId: null, visit: v("x", "2026-11-18") },
    ],
    (id) => (id === "yadira" ? "YADIRA FELICIANO" : id),
  );
  assert.deepEqual(
    groups.map((g) => [g.name, g.visits.map((x) => x.key)]),
    [
      ["YADIRA FELICIANO", ["a", "b"]],
      ["ANA", ["c"]],
    ],
  );
  assert.equal(groups[1].visits[0].kind, "consultation");
});
