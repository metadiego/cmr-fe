import { test } from "node:test";
import assert from "node:assert/strict";

import { readQuery } from "./read-query.ts";

test("readQuery: a stage list goes comma separated; empty values and empty lists are left out", () => {
  const sp = readQuery({ patientId: "p1", bookingStatus: ["rescheduled"], careStatus: [], doctorId: undefined, page: 1 });
  assert.equal(sp.toString(), "patientId=p1&bookingStatus=rescheduled&page=1");
  assert.equal(readQuery({ bookingStatus: ["booked", "confirmed"] }).get("bookingStatus"), "booked,confirmed");
});
