import { test } from "node:test";
import assert from "node:assert/strict";

import { addDaysToDay, canReschedule, pickNextAppointment } from "./next-appointment.ts";

test("picks the first pending appointment strictly after the board day", () => {
  const got = pickNextAppointment(
    [
      { id: "today", date: "2026-11-04", status: "confirmada" },
      { id: "late", date: "2026-12-10", status: "programada" },
      { id: "soon", date: "2026-11-20", status: "confirmada" },
    ],
    "2026-11-04",
  );
  assert.equal(got?.id, "soon");
});

test("skips cancelled, no-show and already-rescheduled appointments, like the BE column", () => {
  const got = pickNextAppointment(
    [
      { id: "c", date: "2026-11-10", status: "cancelada" },
      { id: "n", date: "2026-11-11", status: "no_show" },
      { id: "r", date: "2026-11-12", status: "reprogramada" },
      { id: "ok", date: "2026-11-13", status: "programada" },
    ],
    "2026-11-04",
  );
  assert.equal(got?.id, "ok");
});

test("same day: the earlier time wins; nothing pending gives null", () => {
  const got = pickNextAppointment(
    [
      { id: "pm", date: "2026-11-10", time: "14:00", status: "programada" },
      { id: "am", date: "2026-11-10", time: "09:30", status: "programada" },
    ],
    "2026-11-04",
  );
  assert.equal(got?.id, "am");
  assert.equal(pickNextAppointment([{ id: "x", date: "2026-11-01", status: "programada" }], "2026-11-04"), null);
});

test("only open appointments can be moved", () => {
  assert.equal(canReschedule({ id: "a", date: "2026-11-10", status: "programada" }), true);
  assert.equal(canReschedule({ id: "a", date: "2026-11-10", status: "confirmada" }), true);
  assert.equal(canReschedule({ id: "a", date: "2026-11-10", status: "presente" }), false);
  assert.equal(canReschedule(null), false);
});

test("addDaysToDay crosses months and years without a timezone shift", () => {
  assert.equal(addDaysToDay("2026-11-04", 30), "2026-12-04");
  assert.equal(addDaysToDay("2026-12-25", 7), "2027-01-01");
  assert.equal(addDaysToDay("2026-03-01", -1), "2026-02-28");
});
