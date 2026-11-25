import { test } from "node:test";
import assert from "node:assert/strict";

import type { BookingSlot } from "./availability.ts";
import {
  bookableServicesList,
  EMPTY_RUN_LIMIT,
  filterMedicalTypes,
  emptyRunStep,
  hasBookableTime,
  firstOpening,
  foldText,
  isEmptyDay,
  matchesQuery,
  patientServicesView,
  scanDates,
  typeListGroups,
  visitTypeId,
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

const k = (id: string, slug: string) => ({ id, slug });
const kinds = [k("n", "nueva"), k("s", "seguimiento"), k("o", "otra-consulta")];

test("filterMedicalTypes: attended before drops 'nueva', other slugs untouched", () => {
  assert.deepEqual(filterMedicalTypes(kinds, { attendedBefore: true }).map((x) => x.id), ["s", "o"]);
});

test("filterMedicalTypes: never attended drops 'seguimiento', other slugs untouched", () => {
  assert.deepEqual(filterMedicalTypes(kinds, { attendedBefore: false }).map((x) => x.id), ["n", "o"]);
});

test("filterMedicalTypes: unknown visit kind (loading or failed) keeps every type", () => {
  assert.deepEqual(filterMedicalTypes(kinds, undefined).map((x) => x.id), ["n", "s", "o"]);
});

test("bookableServicesList: only bookable > 0, most bookable first; undefined while unknown", () => {
  const list = bookableServicesList(services, new Map([["s1", { bookable: 2 }], ["s2", { bookable: 0 }], ["s3", { bookable: 5 }]]));
  assert.deepEqual(list?.map((x) => x.id), ["s3", "s1"]);
  assert.equal(bookableServicesList(services, undefined), undefined);
  assert.deepEqual(bookableServicesList(services, new Map()), []);
});

test("typeListGroups patient mode: Medical + the patient's services, no packages/services groups", () => {
  const g = typeListGroups({ medical, services: [services[2], services[0]], packages: new Map([["s2", 3]]), query: "", patientMode: true });
  assert.deepEqual(
    g.map((x) => [x.key, x.items.map((i) => i.id)]),
    [
      ["medical", ["m1", "m2"]],
      ["patientServices", ["s3", "s1"]],
    ],
  );
});

test("typeListGroups patient mode: an empty patient services group stays without a search, drops with one", () => {
  const g = typeListGroups({ medical, services: [], query: "", patientMode: true });
  assert.deepEqual(g.map((x) => [x.key, x.items.length]), [["medical", 2], ["patientServices", 0]]);
  const searched = typeListGroups({ medical, services: [], query: "consulta", patientMode: true });
  assert.deepEqual(searched.map((x) => x.key), ["medical"]);
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

test("emptyRunStep: a service with no bookable time at all stops after EMPTY_RUN_LIMIT days; medical never", () => {
  const empty = { date: "2026-11-04", slots: [] };
  const open = { date: "2026-11-04", slots: [slot("07:00", 1)] };
  assert.equal(EMPTY_RUN_LIMIT, 5);
  let st = { run: 0, sawBookable: false };
  for (let i = 1; i < EMPTY_RUN_LIMIT; i++) {
    const r = emptyRunStep("service", st, empty);
    assert.deepEqual(r, { run: i, sawBookable: false, stop: false });
    st = r;
  }
  assert.deepEqual(emptyRunStep("service", st, empty), { run: EMPTY_RUN_LIMIT, sawBookable: false, stop: true });
  assert.deepEqual(emptyRunStep("service", st, open), { run: 0, sawBookable: true, stop: false });
  assert.deepEqual(emptyRunStep("medical", { run: 20, sawBookable: false }, empty), {
    run: 21,
    sawBookable: false,
    stop: false,
  });
});

test("emptyRunStep: a fully booked week never stops a service scan (openings after it stay visible)", () => {
  const booked = { date: "2026-11-04", slots: [slot("07:00", 0), slot("08:00", 0)] };
  let st = { run: 0, sawBookable: false };
  for (let i = 0; i < 13; i++) {
    const r = emptyRunStep("service", st, booked);
    assert.equal(r.stop, false, `day ${i + 1}`);
    st = r;
  }
  assert.equal(st.run, 13);
  assert.equal(hasBookableTime(booked), true);
  assert.equal(hasBookableTime({ date: "2026-11-04", slots: [] }), false);
});

test("patientServicesView: no permission is a note (never an error), else by the balance's load state", () => {
  for (const bookableState of ["idle", "loading", "ok", "fail"] as const) {
    assert.equal(patientServicesView({ hidden: true, bookableState }), "hidden", bookableState);
  }
  assert.equal(patientServicesView({ hidden: false, bookableState: "idle" }), "loading");
  assert.equal(patientServicesView({ hidden: false, bookableState: "loading" }), "loading");
  assert.equal(patientServicesView({ hidden: false, bookableState: "fail" }), "fail");
  assert.equal(patientServicesView({ hidden: false, bookableState: "ok" }), "list");
});

test("visitTypeId picks follow-up for a patient attended before and first visit otherwise", () => {
  const types = [
    { id: "n", slug: "nueva" },
    { id: "s", slug: "seguimiento" },
    { id: "c", slug: "control" },
  ];
  assert.equal(visitTypeId(types, { attendedBefore: true }), "s");
  assert.equal(visitTypeId(types, { attendedBefore: false }), "n");
  // Not known yet (loading or failed): nothing is picked rather than a guess.
  assert.equal(visitTypeId(types, undefined), "");
  assert.equal(visitTypeId([{ id: "c", slug: "control" }], { attendedBefore: true }), "");
});
