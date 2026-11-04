import { test } from "node:test";
import assert from "node:assert/strict";

import type { BookingSlot } from "./availability.ts";
import {
  EMPTY_RUN_LIMIT,
  emptyRunStep,
  firstOpening,
  foldText,
  isEmptyDay,
  matchesQuery,
  scanDates,
  typeListGroups,
} from "./type-list.ts";

test("foldText: no accents, lower case, trimmed", () => {
  assert.equal(foldText(" Sónica "), "sonica");
  assert.equal(foldText("CÁMARA Hiperbárica"), "camara hiperbarica");
  assert.equal(foldText("Niño"), "nino");
});

test("matchesQuery: accent- and case-insensitive, every word anywhere", () => {
  assert.ok(matchesQuery("Sónica", "sonica"));
  assert.ok(matchesQuery("Sonica", "SÓN"));
  assert.ok(matchesQuery("Vitamina C", "c vit"));
  assert.ok(matchesQuery("Láser", ""));
  assert.ok(matchesQuery("Láser", "   "));
  assert.ok(!matchesQuery("Láser", "suero"));
});

const t = (id: string, name: string) => ({ id, name });
const medical = [t("m1", "Consulta nueva"), t("m2", "Seguimiento")];
const services = [t("s1", "Láser"), t("s2", "EMTT"), t("s3", "Sueroterapia"), t("s4", "SÓNICA")];

test("typeListGroups: Medical, then the patient's packages, then the other services, in input order", () => {
  const g = typeListGroups({ medical, services, packages: new Map([["s3", 2], ["s1", 6], ["s2", 0]]), query: "" });
  assert.deepEqual(
    g.map((x) => [x.key, x.items.map((i) => i.id)]),
    [
      ["medical", ["m1", "m2"]],
      ["packages", ["s1", "s3"]],
      ["services", ["s2", "s4"]],
    ],
  );
});

test("typeListGroups: no packages group without sessions left; empty Medical/Services kept without a search", () => {
  const g = typeListGroups({ medical: [], services, packages: new Map(), query: "" });
  assert.deepEqual(g.map((x) => x.key), ["medical", "services"]);
  assert.equal(g[0].items.length, 0);
});

test("typeListGroups: the search filters every group and drops the empty ones", () => {
  const g = typeListGroups({ medical, services, packages: new Map([["s1", 6]]), query: "sonica" });
  assert.deepEqual(g.map((x) => [x.key, x.items.map((i) => i.id)]), [["services", ["s4"]]]);
  assert.deepEqual(typeListGroups({ medical, services, packages: new Map(), query: "zzz" }), []);
  const lasers = typeListGroups({ medical, services, packages: new Map([["s1", 6]]), query: "LASER" });
  assert.deepEqual(lasers.map((x) => x.key), ["packages"]);
});

test("scanDates: n bookable days from today, skipping Sundays and holidays", () => {
  // 2026-11-07 is a Saturday, 2026-11-08 a Sunday.
  assert.deepEqual(scanDates("2026-11-06", ["2026-11-10"], 4), [
    "2026-11-06",
    "2026-11-07",
    "2026-11-09",
    "2026-11-11",
  ]);
  assert.equal(scanDates("2026-11-04", [], 14).length, 14);
  assert.deepEqual(scanDates("2026-11-04", [], 0), []);
});

const slot = (time: string, free: number): BookingSlot => ({
  time,
  free,
  capacity: 2,
  state: free > 0 ? "open" : "full",
  reasonKey: null,
});

test("firstOpening: first time with room, today only from now on", () => {
  const day = { date: "2026-11-04", slots: [slot("07:00", 1), slot("08:00", 0), slot("15:40", 2)] };
  assert.equal(firstOpening(day, { date: "2026-11-03" }), "07:00");
  assert.equal(firstOpening(day, { date: "2026-11-04", time: "07:30" }), "15:40");
  assert.equal(firstOpening(day, { date: "2026-11-04", time: "16:00" }), null);
  assert.equal(firstOpening({ date: "2026-11-05", slots: [slot("09:00", 0)] }, { date: "2026-11-04" }), null);
});

test("isEmptyDay: no times, or none with room", () => {
  assert.ok(isEmptyDay({ date: "2026-11-04", slots: [] }));
  assert.ok(isEmptyDay({ date: "2026-11-04", slots: [slot("07:00", 0)] }));
  assert.ok(!isEmptyDay({ date: "2026-11-04", slots: [slot("07:00", 0), slot("08:00", 1)] }));
});

test("emptyRunStep: a service stops after EMPTY_RUN_LIMIT empty days in a row; medical never", () => {
  const empty = { date: "2026-11-04", slots: [] };
  const open = { date: "2026-11-04", slots: [slot("07:00", 1)] };
  assert.equal(EMPTY_RUN_LIMIT, 5);
  let run = 0;
  for (let i = 1; i < EMPTY_RUN_LIMIT; i++) {
    const r = emptyRunStep("service", run, empty);
    assert.deepEqual(r, { run: i, stop: false });
    run = r.run;
  }
  assert.deepEqual(emptyRunStep("service", run, empty), { run: EMPTY_RUN_LIMIT, stop: true });
  assert.deepEqual(emptyRunStep("service", run, open), { run: 0, stop: false });
  assert.deepEqual(emptyRunStep("medical", 20, empty), { run: 21, stop: false });
});
