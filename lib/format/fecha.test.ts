// Lock del bug off-by-one: una fecha solo-día NUNCA debe retroceder por zona horaria. Correr: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { formatFechaSolo, isTodayPR, parseDayUTC, parseFechaEscrita, validarFechaNacimiento } from "./fecha.ts";

test("fecha solo-día se formatea MM/DD/YYYY sin corrimiento", () => {
  assert.equal(formatFechaSolo("2026-07-21"), "07/21/2026");
});

test("no retrocede un día (el bug original: 07/21 salía 07/20)", () => {
  assert.notEqual(formatFechaSolo("2026-07-21"), "07/20/2026");
});

test("datetime con hora usa la fecha (parte de día)", () => {
  assert.equal(formatFechaSolo("2026-07-21T09:30:00-04:00"), "07/21/2026");
});

test("vacío/nulo → cadena vacía", () => {
  assert.equal(formatFechaSolo(""), "");
  assert.equal(formatFechaSolo(null), "");
  assert.equal(formatFechaSolo(undefined), "");
});

test("primer día del mes/año no se corre", () => {
  assert.equal(formatFechaSolo("2026-01-01"), "01/01/2026");
});

// --- parseDayUTC: the anchor that makes the day-only formats exact ---------------

test("parseDayUTC anchors the day at UTC noon", () => {
  const d = parseDayUTC("2026-07-21");
  assert.equal(d?.toISOString(), "2026-07-21T12:00:00.000Z");
});

test("parseDayUTC prints the SAME day in eastern and western zones", () => {
  const d = parseDayUTC("2026-09-04")!;
  const opts = { day: "numeric", month: "long", year: "numeric" } as const;
  // UTC (what the day-only formats pin), PR (west) and Tokyo (east).
  for (const timeZone of ["UTC", "America/Puerto_Rico", "Asia/Tokyo"]) {
    assert.match(
      new Intl.DateTimeFormat("en-US", { ...opts, timeZone }).format(d),
      /September 4, 2026/,
    );
  }
});

test("parseDayUTC does not roll back on the first day of the month", () => {
  const d = parseDayUTC("2026-01-01")!;
  assert.equal(
    new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(d),
    "January 2026",
  );
});

test("parseDayUTC takes the day part of a full datetime", () => {
  assert.equal(parseDayUTC("2026-07-21T09:30:00-04:00")?.toISOString(), "2026-07-21T12:00:00.000Z");
});

test("parseDayUTC returns null for empty/invalid input", () => {
  assert.equal(parseDayUTC(""), null);
  assert.equal(parseDayUTC(null), null);
  assert.equal(parseDayUTC("no-a-date"), null);
});

// --- parseFechaEscrita: MM/DD/YYYY typed by hand, never DD/MM -----------------------

test("parseFechaEscrita: con barra, con guion, y sin separador dan la misma fecha", () => {
  assert.deepEqual(parseFechaEscrita("03/15/1958"), { ok: true, iso: "1958-03-15" });
  assert.deepEqual(parseFechaEscrita("3/15/1958"), { ok: true, iso: "1958-03-15" });
  assert.deepEqual(parseFechaEscrita("03-15-1958"), { ok: true, iso: "1958-03-15" });
  assert.deepEqual(parseFechaEscrita("03151958"), { ok: true, iso: "1958-03-15" });
  assert.deepEqual(parseFechaEscrita("  03/15/1958  "), { ok: true, iso: "1958-03-15" });
});

test("parseFechaEscrita: formato que no casa ninguna forma", () => {
  assert.deepEqual(parseFechaEscrita("1958-03-15"), { ok: false, razon: "formato" });
  assert.deepEqual(parseFechaEscrita("marzo 15 1958"), { ok: false, razon: "formato" });
  assert.deepEqual(parseFechaEscrita(""), { ok: false, razon: "formato" });
});

test("parseFechaEscrita: mes/día fuera de rango, o un día que no existe (30 de febrero)", () => {
  assert.deepEqual(parseFechaEscrita("13/01/1958"), { ok: false, razon: "invalida" });
  assert.deepEqual(parseFechaEscrita("02/30/1958"), { ok: false, razon: "invalida" });
  assert.deepEqual(parseFechaEscrita("00/15/1958"), { ok: false, razon: "invalida" });
});

test("parseFechaEscrita: el 29 de febrero solo en años bisiestos", () => {
  assert.deepEqual(parseFechaEscrita("02/29/2000"), { ok: true, iso: "2000-02-29" });
  assert.deepEqual(parseFechaEscrita("02/29/1900"), { ok: false, razon: "invalida" });
});

test("parseFechaEscrita: una fecha FUTURA es válida aquí — una cita o un vencimiento lo es (owner 17-nov-2026)", () => {
  assert.deepEqual(parseFechaEscrita("01/01/2099"), { ok: true, iso: "2099-01-01" });
});

test("parseFechaEscrita: una edad centenaria es válida aquí — esa regla no es universal", () => {
  assert.deepEqual(parseFechaEscrita("01/01/1850"), { ok: true, iso: "1850-01-01" });
});

// --- validarFechaNacimiento: SOLO para el campo fecha de nacimiento ------------------

test("validarFechaNacimiento: futura rechazada", () => {
  assert.equal(validarFechaNacimiento("2099-01-01"), "futura");
});

test("validarFechaNacimiento: edad > 120 rechazada", () => {
  assert.equal(validarFechaNacimiento("1850-01-01"), "edad");
});

test("validarFechaNacimiento: una fecha de nacimiento razonable no tiene problema", () => {
  assert.equal(validarFechaNacimiento("1958-03-15"), null);
});

// --- isTodayPR: comparar en la zona del centro, no la del navegador/servidor -------

test("isTodayPR: misma fecha en PR aunque el instante caiga del otro lado de medianoche UTC", () => {
  const now = new Date("2026-11-21T02:00:00Z"); // 20-nov 22:00 en PR (AST, UTC-4) → "hoy" es 20-nov
  assert.equal(isTodayPR("2026-11-21T01:00:00Z", now), true); // 20-nov 21:00 en PR — mismo día PR, otro día UTC
  assert.equal(isTodayPR("2026-11-19T23:00:00Z", now), false); // 19-nov 19:00 en PR — un día antes de verdad
});

test("isTodayPR: null, vacío o un instante no parseable nunca cuentan como hoy", () => {
  const now = new Date("2026-11-21T02:00:00Z");
  assert.equal(isTodayPR(null, now), false);
  assert.equal(isTodayPR(undefined, now), false);
  assert.equal(isTodayPR("no-es-una-fecha", now), false);
});
