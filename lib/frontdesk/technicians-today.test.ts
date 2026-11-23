import { test } from "node:test";
import assert from "node:assert/strict";

import { breakMinutes, onShiftState, techniciansNow } from "./technicians-today.ts";
import type { FrontdeskQueue } from "../api/frontdesk-queue.ts";

const svc = (
  name: string,
  inTherapy: Array<[string, string, string | null, string]>,
  waiting: Array<[string | null, string | null]> = [],
) =>
  ({
    name,
    inTherapy: inTherapy.map(([technicianId, technicianName, medicalRecordNumber, patientName]) => ({
      technicianId,
      technicianName,
      medicalRecordNumber,
      patientName,
    })),
    waiting: waiting.map(([technicianId, technicianName]) => ({ technicianId, technicianName })),
  }) as unknown as FrontdeskQueue["services"][number];

test("techniciansToday: who finished their patient is FREE; in therapy is busy with its service, record and patient", () => {
  const q = {
    services: [svc("Láser", [["t2", "Ana", "103165", "Jose Ramos"]])],
    techniciansToday: [
      { staffId: "t1", name: "Fabian Rodriguez", clinicId: "c", sessions: 1, inTherapy: false },
      { staffId: "t2", name: "Ana", clinicId: "c", sessions: 3, inTherapy: true },
    ],
  } as unknown as FrontdeskQueue;
  const r = techniciansNow(q);
  assert.deepEqual(r.libres, [{ id: "t1", name: "Fabian Rodriguez" }]);
  assert.deepEqual(r.ocupados, [
    { id: "t2", name: "Ana", servicio: "Láser", patients: [{ record: "103165", name: "Jose Ramos" }] },
  ]);
  assert.deepEqual([...r.activosHoy.keys()], ["t1", "t2"]);
});

test("owner, 23-nov: two patients in therapy with the same technician at once shows BOTH", () => {
  const q = {
    services: [
      svc("EMTT", [
        ["t2", "Ana", "103165", "Jose Ramos"],
        ["t2", "Ana", "103200", "Maria Lopez"],
      ]),
    ],
    techniciansToday: [{ staffId: "t2", name: "Ana", clinicId: "c", sessions: 2, inTherapy: true }],
  } as unknown as FrontdeskQueue;
  const r = techniciansNow(q);
  assert.deepEqual(r.ocupados, [
    {
      id: "t2",
      name: "Ana",
      servicio: "EMTT",
      patients: [
        { record: "103165", name: "Jose Ramos" },
        { record: "103200", name: "Maria Lopez" },
      ],
    },
  ]);
});

test("a patient with no record keeps their name, record null", () => {
  const q = {
    services: [svc("EMTT", [["t2", "Ana", null, "Jose Ramos"]])],
    techniciansToday: [{ staffId: "t2", name: "Ana", clinicId: "c", sessions: 1, inTherapy: true }],
  } as unknown as FrontdeskQueue;
  const r = techniciansNow(q);
  assert.deepEqual(r.ocupados, [
    { id: "t2", name: "Ana", servicio: "EMTT", patients: [{ record: null, name: "Jose Ramos" }] },
  ]);
});

test("techniciansToday ignores waiting[]: only the roster defines who is active", () => {
  const q = { services: [svc("Sónica", [], [["tx", "Called"]])], techniciansToday: [] } as unknown as FrontdeskQueue;
  const r = techniciansNow(q);
  assert.deepEqual(r.libres, []);
  assert.equal(r.activosHoy.size, 0);
});

test("fallback without techniciansToday: busy from inTherapy, free from called waiting", () => {
  const q = {
    services: [
      svc("Láser", [["t2", "Ana", "103165", "Jose Ramos"]], [["t1", "Fabian"], ["t2", "Ana"], [null, null]]),
    ],
  } as unknown as FrontdeskQueue;
  const r = techniciansNow(q);
  assert.deepEqual(r.libres, [{ id: "t1", name: "Fabian" }]);
  assert.deepEqual(r.ocupados, [
    { id: "t2", name: "Ana", servicio: "Láser", patients: [{ record: "103165", name: "Jose Ramos" }] },
  ]);
  assert.deepEqual(techniciansNow(null), { libres: [], ocupados: [], activosHoy: new Map() });
});

test("breakMinutes: the type's durationOptions, sorted and unique; null/empty/missing → 10/15/30", () => {
  assert.deepEqual(breakMinutes({ durationOptions: [60, 10, 15, 30, 45, 15] }), [10, 15, 30, 45, 60]);
  assert.deepEqual(breakMinutes({ durationOptions: null }), [10, 15, 30]);
  assert.deepEqual(breakMinutes({ durationOptions: [] }), [10, 15, 30]);
  assert.deepEqual(breakMinutes({}), [10, 15, 30]);
  assert.deepEqual(breakMinutes(undefined), [10, 15, 30]);
});

test("onShiftState: load 0 and not here today is «not yet today», not busy", () => {
  assert.equal(onShiftState({ available: true, presentToday: true }), "free");
  assert.equal(onShiftState({ available: false, presentToday: false }), "notYetToday");
  assert.equal(onShiftState({ available: false, presentToday: true }), "busy");
  assert.equal(onShiftState({ available: false }), "busy");
});
