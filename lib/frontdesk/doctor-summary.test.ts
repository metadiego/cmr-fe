import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DOCTOR_SUMMARY_COLUMNS,
  allowedDoctorSummaryColumns,
  sortedByDoctor,
  toggleDoctorSummaryColumn,
  totalCarried,
  visibleDoctorSummaryColumns,
} from "./doctor-summary.ts";

test("allowedDoctorSummaryColumns drops the money columns without factura.read", () => {
  assert.deepEqual(allowedDoctorSummaryColumns(true), [...DEFAULT_DOCTOR_SUMMARY_COLUMNS]);
  const withoutMoney = allowedDoctorSummaryColumns(false);
  assert.equal(withoutMoney.includes("amount"), false);
  assert.equal(withoutMoney.includes("paymentMethod"), false);
  assert.equal(withoutMoney.includes("record"), true);
});

test("visibleDoctorSummaryColumns never shows money columns to someone without factura.read, even if saved", () => {
  assert.deepEqual(visibleDoctorSummaryColumns(["record", "amount", "bogus"], false), ["record"]);
  assert.deepEqual(visibleDoctorSummaryColumns(["record", "amount"], true), ["record", "amount"]);
  assert.equal(visibleDoctorSummaryColumns(undefined, false).includes("amount"), false);
});

test("toggleDoctorSummaryColumn adds in table order and never hides the last column", () => {
  assert.deepEqual(toggleDoctorSummaryColumn(["record", "time"], "doctor"), ["record", "doctor", "time"]);
  assert.deepEqual(toggleDoctorSummaryColumn(["record", "time"], "time"), ["record"]);
  assert.deepEqual(toggleDoctorSummaryColumn(["record"], "record"), ["record"]);
});

test("totalCarried sums each doctor's own carried, not appointments", () => {
  assert.equal(
    totalCarried([
      { carried: 3 },
      { carried: 2 },
      { carried: 0 },
    ]),
    5
  );
  assert.equal(totalCarried([]), 0);
});

test("sortedByDoctor: busiest first, doctor-less last, ties by name", () => {
  const byDoctor = [
    { doctorId: null, doctor: null, total: 4, attended: 0, inConsultation: 0, waiting: 4, scheduled: 0, carried: 4, byType: [], amount: null },
    { doctorId: "b", doctor: "Victor", total: 3, attended: 3, inConsultation: 0, waiting: 0, scheduled: 0, carried: 3, byType: [], amount: null },
    { doctorId: "a", doctor: "Sheila", total: 3, attended: 2, inConsultation: 1, waiting: 0, scheduled: 0, carried: 3, byType: [], amount: null },
    { doctorId: "c", doctor: "Christina", total: 2, attended: 2, inConsultation: 0, waiting: 0, scheduled: 0, carried: 2, byType: [], amount: null },
  ];
  assert.deepEqual(
    sortedByDoctor(byDoctor).map((d) => d.doctor),
    ["Sheila", "Victor", "Christina", null]
  );
});
