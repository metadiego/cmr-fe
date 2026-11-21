import { test } from "node:test";
import assert from "node:assert/strict";

import type { FormatoArmado } from "../api/formatos.ts";
import type { SheetAnswers } from "../api/format-answers.ts";
import {
  answeredCount,
  answerKey,
  fillableSlugsFrom,
  initialSheetState,
  isoToLocalPR,
  isReadOnlyField,
  localPRToIso,
  nowLocalPR,
  readNumber,
  writeBackErrorOf,
  writeBackProblems,
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

test("fillable on screen is whatever GET /formats itself says, generic per format (cmr-be #665)", () => {
  const slugs = fillableSlugsFrom([
    { slug: "glp1_adherencia", fillable: true },
    { slug: "bpc157_enfermeria", fillable: false },
    { slug: "hilt", fillable: null },
  ]);
  assert.deepEqual([...slugs], ["glp1_adherencia"]);
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

test("weight is read like the BE reads it", () => {
  assert.equal(readNumber("212.4"), 212.4);
  assert.equal(readNumber("212,4 lb"), 212.4);
  assert.equal(readNumber("180lbs"), 180);
  assert.equal(readNumber(""), null);
  assert.equal(readNumber("ciento"), null);
});

test("a weight outside the writeBack range is caught before saving; empty or unreadable is not", () => {
  const fields = [{ clave: "peso", writeBack: { target: "scale.weightLbs", min: 50, max: 700 } }, { clave: "ta" }];
  assert.deepEqual(writeBackProblems(fields, { peso: "21.2", ta: "9" }), [{ key: "peso", min: 50, max: 700 }]);
  assert.deepEqual(writeBackProblems(fields, { peso: "212.4 lb" }), []);
  assert.deepEqual(writeBackProblems(fields, { peso: "" }), []);
  assert.deepEqual(writeBackProblems(fields, { peso: "n/a" }), []);
});

test("the BE's 400 out-of-range names the field (body or its error object)", () => {
  const error = { code: "FORMAT_WRITE_BACK_OUT_OF_RANGE", key: "peso", value: 21.2, min: 50, max: 700 };
  assert.deepEqual(writeBackErrorOf({ code: error.code, data: { error } }), { key: "peso", min: 50, max: 700 });
  assert.deepEqual(writeBackErrorOf({ code: error.code, data: error }), { key: "peso", min: 50, max: 700 });
  assert.equal(writeBackErrorOf({ code: "OTHER", data: { error } }), null);
  assert.equal(writeBackErrorOf(null), null);
});
