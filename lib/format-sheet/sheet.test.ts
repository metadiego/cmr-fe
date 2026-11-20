import { test } from "node:test";
import assert from "node:assert/strict";

import type { FormatoArmado } from "../api/formatos.ts";
import type { SheetAnswers, SheetSession } from "../api/format-answers.ts";
import {
  answeredCount,
  answerKey,
  filterSheetSessions,
  initialSheetState,
  isFillableSheet,
  isoToLocalPR,
  isReadOnlyField,
  localPRToIso,
  measurementLinked,
  nowLocalPR,
  openRequestFor,
  sheetPath,
  sheetPayload,
  sheetProblems,
  sheetQuestions,
} from "./sheet.ts";

// Shapes copied from docs/specs/glp1-hoja-enfermeria-ipad-contrato-be.md.
const assembly = {
  sections: [
    {
      clave: "cotejo",
      tipo: "checklist",
      grupos: [
        { titulo: "1. Hidratación", preguntas: [{ texto: "¿2 a 3 litros?" }, { texto: "¿Refrescos?" }] },
        { titulo: "2. Alimentación", preguntas: [{ texto: "¿Proteína?" }] },
      ],
    },
    { clave: "obs", tipo: "texto_libre" },
  ],
} as unknown as FormatoArmado;

const unsaved: SheetAnswers = {
  formatSlug: "glp1_adherencia",
  sessionId: "s1",
  clinicId: "c1",
  clinicName: "Bayamón",
  saved: false,
  fields: [],
  answers: [],
  additionalNotes: null,
  nurseId: null,
  recordedAt: null,
  updatedBy: null,
  updatedAt: null,
  suggested: {
    fields: [
      { key: "paciente", value: "Ana Ruiz" },
      { key: "peso", value: "211.6" },
      { key: "ta", value: null },
      { key: "semana", value: "1" },
    ],
    patient: { id: "p1", name: "Ana Ruiz", medicalRecordNumber: "77" },
    date: "2026-11-20",
    nurse: { id: "n1", name: "Marta Díaz" },
  },
};

const NOW = new Date("2026-11-20T18:30:00Z"); // 14:30 in Puerto Rico

test("only the declared formats are fillable on screen", () => {
  assert.equal(isFillableSheet("glp1_adherencia"), true);
  assert.equal(isFillableSheet("bpc157_enfermeria"), false);
  assert.equal(isFillableSheet(undefined), false);
  assert.equal(sheetPath("glp1_adherencia", "a b"), "/forms/glp1_adherencia/a%20b");
});

test("patient identity is read-only; what the nurse measures is editable", () => {
  assert.equal(isReadOnlyField({ origen: "paciente.nombre" }), true);
  assert.equal(isReadOnlyField({ origen: "sesion.fecha" }), true);
  assert.equal(isReadOnlyField({ origen: "sesion.dosis" }), false);
  assert.equal(isReadOnlyField({}), false);
});

test("questions come from the checklist by position, with the group band on the first one", () => {
  const qs = sheetQuestions(assembly);
  assert.deepEqual(
    qs.map((q) => [answerKey(q), q.groupTitle]),
    [
      ["0:0:0", "1. Hidratación"],
      ["0:0:1", null],
      ["0:1:0", "2. Alimentación"],
    ],
  );
});

test("unsaved: the suggestion pre-fills, null becomes empty, the visit's nurse and now are proposed", () => {
  const s = initialSheetState(unsaved, 0, NOW);
  assert.equal(s.fields.peso, "211.6");
  assert.equal(s.fields.ta, "");
  assert.equal(s.nurseId, "n1");
  assert.equal(s.recordedAt, "2026-11-20T14:30");
  assert.deepEqual(s.answers, {});
});

test("saved: what was saved wins over the suggestion, even when it was cleared", () => {
  const saved: SheetAnswers = {
    ...unsaved,
    saved: true,
    fields: [
      { key: "peso", value: "212.4" },
      { key: "semana", value: null },
    ],
    answers: [{ group: 0, question: 1, value: "no", note: "refrescos" }],
    additionalNotes: "Estable",
    nurseId: "n2",
    recordedAt: "2026-11-20T13:05:00.000Z",
  };
  const s = initialSheetState(saved, 0, NOW);
  assert.equal(s.fields.peso, "212.4");
  assert.equal(s.fields.semana, "", "cleared on save stays cleared");
  assert.equal(s.fields.paciente, "Ana Ruiz", "not saved → suggestion");
  assert.deepEqual(s.answers["0:0:1"], { value: "no", note: "refrescos" });
  assert.equal(s.nurseId, "n2");
  assert.equal(s.recordedAt, "2026-11-20T09:05");
});

test("the payload is the whole sheet: every question, trimmed notes, editable fields only", () => {
  const qs = sheetQuestions(assembly);
  const state = initialSheetState(unsaved, 0, NOW);
  state.fields.ta = " 120/80 ";
  state.answers["0:0:0"] = { value: "yes", note: "  " };
  state.answers["0:1:0"] = { value: "no", note: " poca " };
  state.additionalNotes = "  ";
  const body = sheetPayload(state, ["peso", "ta", "semana", "medicamento"], qs);
  assert.deepEqual(body.fields, [
    { key: "peso", value: "211.6" },
    { key: "ta", value: "120/80" },
    { key: "semana", value: "1" },
    { key: "medicamento", value: null },
  ]);
  assert.deepEqual(body.answers, [
    { section: 0, group: 0, question: 0, value: "yes" },
    { section: 0, group: 0, question: 1, value: null },
    { section: 0, group: 1, question: 0, value: "no", note: "poca" },
  ]);
  assert.equal(body.additionalNotes, null);
  assert.equal(body.nurseId, "n1");
  assert.equal(body.recordedAt, "2026-11-20T14:30:00-04:00");
  assert.equal(answeredCount(state, qs), 2);
});

test("Puerto Rico wall clock round-trips (no DST)", () => {
  assert.equal(nowLocalPR(new Date("2026-07-01T03:15:00Z")), "2026-06-30T23:15");
  assert.equal(localPRToIso("2026-11-20T14:30"), "2026-11-20T14:30:00-04:00");
  assert.equal(localPRToIso("2026-11-20"), null);
  assert.equal(isoToLocalPR("2026-11-20T14:30:00-04:00"), "2026-11-20T14:30");
  assert.equal(isoToLocalPR("nope"), null);
});

test("too long is a reason, never a missing field", () => {
  const state = initialSheetState(unsaved, 0, NOW);
  assert.deepEqual(sheetProblems(state), []);
  state.fields.ta = "x".repeat(501);
  state.answers["0:0:0"] = { value: "yes", note: "y".repeat(1001) };
  state.additionalNotes = "z".repeat(4001);
  assert.deepEqual(sheetProblems(state), [
    { kind: "field", key: "ta" },
    { kind: "note", key: "0:0:0" },
    { kind: "additionalNotes" },
  ]);
});

test("the day list filters by name or record, accent-insensitive", () => {
  const row = (name: string, rec: string): SheetSession => ({
    sessionId: rec,
    clinicId: "c1",
    clinicName: null,
    date: "2026-11-20",
    time: null,
    status: "presente",
    patient: { id: rec, name, medicalRecordNumber: rec },
    nurse: null,
    sheetSaved: false,
    savedAt: null,
  });
  const list = [row("José Pérez", "R15808"), row("Ana Ruiz", "77")];
  assert.deepEqual(filterSheetSessions(list, "jose").map((s) => s.sessionId), ["R15808"]);
  assert.deepEqual(filterSheetSessions(list, "77").map((s) => s.sessionId), ["77"]);
  assert.equal(filterSheetSessions(list, " ").length, 2);
});

test("«Enviar al iPad» opens only on the iPad of the person it was sent to", () => {
  const e = {
    entity: "format_sheet",
    action: "open_requested",
    status: { formatSlug: "glp1_adherencia", sessionId: "s1", toUserId: "n1", patient: { name: "Ana Ruiz" } },
  };
  assert.deepEqual(openRequestFor(e, "n1"), { slug: "glp1_adherencia", sessionId: "s1", patientName: "Ana Ruiz" });
  assert.equal(openRequestFor(e, "n2"), null);
  assert.equal(openRequestFor(e, null), null);
  assert.equal(openRequestFor({ ...e, entity: "sesion" }, "n1"), null);
});

test("a newly linked measurement is offered with its visit", () => {
  const e = {
    entity: "body_measurement",
    action: "linked",
    status: { kind: "scale", sessionId: "s1", date: "2026-11-20", patient: { name: "Ana Ruiz" } },
  };
  assert.deepEqual(measurementLinked(e), { sessionId: "s1", patientName: "Ana Ruiz", date: "2026-11-20" });
  assert.equal(measurementLinked({ ...e, action: "updated" }), null);
  assert.equal(measurementLinked({ ...e, status: {} }), null);
});
