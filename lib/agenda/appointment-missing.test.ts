import { test } from "node:test";
import assert from "node:assert/strict";

import { appointmentMissing } from "./appointment-missing.ts";

const full = {
  clinicPicker: true,
  clinicId: "c-1",
  date: "2026-11-18",
  time: "09:00",
  endTime: "09:30",
  patientId: "p-1",
  doctorRequired: true,
  doctorId: "d-1",
  typeId: "t-1",
};

test("appointmentMissing: all present → []", () => {
  assert.deepEqual(appointmentMissing(full), []);
});
test("appointmentMissing: picker shown, no clinic → clinic listed", () => {
  assert.deepEqual(appointmentMissing({ ...full, clinicId: "" }), ["clinic"]);
});
test("appointmentMissing: no picker → clinic never listed", () => {
  assert.deepEqual(appointmentMissing({ ...full, clinicPicker: false, clinicId: "" }), []);
});
test("appointmentMissing: blank date → date listed", () => {
  assert.deepEqual(appointmentMissing({ ...full, date: " " }), ["date"]);
});
test("appointmentMissing: no start time → time listed", () => {
  assert.deepEqual(appointmentMissing({ ...full, time: "" }), ["time"]);
});
test("appointmentMissing: no end time → time listed", () => {
  assert.deepEqual(appointmentMissing({ ...full, endTime: "" }), ["time"]);
});
test("appointmentMissing: no patient → patient listed", () => {
  assert.deepEqual(appointmentMissing({ ...full, patientId: null }), ["patient"]);
});
test("appointmentMissing: doctor required and none → doctor listed", () => {
  assert.deepEqual(appointmentMissing({ ...full, doctorId: "" }), ["doctor"]);
});
test("appointmentMissing: doctor not required → «Sin médico» is fine", () => {
  assert.deepEqual(appointmentMissing({ ...full, doctorRequired: false, doctorId: "" }), []);
});
test("appointmentMissing: no type → type listed", () => {
  assert.deepEqual(appointmentMissing({ ...full, typeId: "" }), ["type"]);
});
test("appointmentMissing: empty form → every field in on-screen order", () => {
  assert.deepEqual(
    appointmentMissing({ ...full, clinicId: "", date: "", time: "", endTime: "", patientId: null, doctorId: "", typeId: "" }),
    ["clinic", "date", "time", "patient", "doctor", "type"],
  );
});
