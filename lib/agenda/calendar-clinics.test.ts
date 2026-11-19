import test from "node:test";
import assert from "node:assert/strict";
import { dayHoliday, pickOneClinic, servicesByName, shortClinicNames, type HolidayRow } from "./calendar-clinics.ts";

const readable = ["bay", "cag"];

test("pickOneClinic: the single ticked clinic wins over the active one", () => {
  assert.equal(pickOneClinic({ readable, choice: ["cag"], active: "bay", session: "bay" }), "cag");
});

test("pickOneClinic: every clinic or several ticked → the active one", () => {
  assert.equal(pickOneClinic({ readable, choice: null, active: "cag", session: "bay" }), "cag");
  assert.equal(pickOneClinic({ readable: [...readable, "hum"], choice: ["bay", "hum"], active: "cag", session: null }), "cag");
});

test("pickOneClinic: no active one → the session's, else the first readable", () => {
  assert.equal(pickOneClinic({ readable, choice: null, active: null, session: "cag" }), "cag");
  assert.equal(pickOneClinic({ readable, choice: null, active: "elsewhere", session: null }), "bay");
  assert.equal(pickOneClinic({ readable: [], choice: null, active: "bay", session: null }), null);
});

test("pickOneClinic: a ticked clinic no longer readable is ignored", () => {
  assert.equal(pickOneClinic({ readable, choice: ["gone"], active: "bay", session: null }), "bay");
});

test("shortClinicNames drops the words every name starts with", () => {
  const m = shortClinicNames(["CMR Caguas", "CMR Bayamon"]);
  assert.equal(m.get("CMR Caguas"), "Caguas");
  assert.equal(m.get("CMR Bayamon"), "Bayamon");
});

test("shortClinicNames keeps a name whole when nothing is shared, or it is the only one", () => {
  assert.equal(shortClinicNames(["Caguas", "Bayamon"]).get("Caguas"), "Caguas");
  assert.equal(shortClinicNames(["CMR Caguas"]).get("CMR Caguas"), "CMR Caguas");
  // Never empties a name that is all shared words.
  assert.equal(shortClinicNames(["CMR", "CMR Norte"]).get("CMR"), "CMR");
});

const h = (over: Partial<HolidayRow>): HolidayRow => ({
  clinicId: "bay",
  clinicName: "CMR Bayamon",
  date: "2026-11-19",
  name: "Descubrimiento",
  recursAnnually: false,
  active: true,
  ...over,
});
const short = (n: string) => shortClinicNames(["CMR Bayamon", "CMR Caguas"]).get(n) ?? n;

test("dayHoliday: one clinic shown reads as before", () => {
  assert.deepEqual(dayHoliday([h({})], "2026-11-19", ["bay"], short), { label: "Descubrimiento", allClinics: true });
  assert.equal(dayHoliday([h({})], "2026-11-20", ["bay"], short), null);
});

test("dayHoliday: several clinics, only one closed → not tinted, says whose", () => {
  assert.deepEqual(dayHoliday([h({})], "2026-11-19", ["bay", "cag"], short), {
    label: "Descubrimiento (Bayamon)",
    allClinics: false,
  });
});

test("dayHoliday: every clinic shown closed → tinted, the name once", () => {
  const rows = [h({}), h({ clinicId: "cag", clinicName: "CMR Caguas" })];
  assert.deepEqual(dayHoliday(rows, "2026-11-19", ["bay", "cag"], short), { label: "Descubrimiento", allClinics: true });
});

test("dayHoliday: a global holiday (no clinic) closes every clinic", () => {
  assert.equal(dayHoliday([h({ clinicId: null, clinicName: null })], "2026-11-19", ["bay", "cag"])?.allClinics, true);
});

test("dayHoliday: recurring and inactive holidays", () => {
  assert.ok(dayHoliday([h({ date: "2020-11-19", recursAnnually: true })], "2026-11-19", ["bay"]));
  assert.equal(dayHoliday([h({ active: false })], "2026-11-19", ["bay"]), null);
});

test("servicesByName: one option per name, each clinic's row in its ids", () => {
  const opts = servicesByName([
    { id: "b1", name: "Laser", color: "#f00" },
    { id: "b2", name: "Sueroterapia", color: null },
    { id: "c1", name: "laser ", color: "#0f0" },
  ]);
  assert.deepEqual(
    opts.map((o) => [o.name, o.color, o.ids]),
    [
      ["Laser", "#f00", ["b1", "c1"]],
      ["Sueroterapia", null, ["b2"]],
    ],
  );
});
