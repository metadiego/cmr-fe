import { test } from "node:test";
import assert from "node:assert/strict";

import { buildAppointmentSheetHtml, APPOINTMENT_SHEET_CSS, type AppointmentSheetInput } from "./appointment-sheet.ts";

const base: AppointmentSheetInput = {
  lang: "es",
  logoUrl: "https://app.example/img/logo_cmr_bw.png",
  center: { name: "CMR Bayamon", address: "51 Calle Dr. Santiago Veve, Bayamón, 00961", phone: "787-780-7575" },
  heading: "Sus próximas citas",
  patientName: "Perez, Juanito",
  record: "Récord 1234",
  rows: [
    {
      weekday: "mié",
      day: "9",
      month: "dic",
      dateLong: "miércoles, 9 de diciembre de 2026",
      time: "11:00",
      service: "CONSULTA NUEVA",
      doctor: null,
    },
  ],
  callUs: "Si no puede asistir, llame al 787-780-7575.",
  printedOn: "Impreso el 25 nov 2026",
};

test("appointment sheet: a full document titled by the center, in the app's language", () => {
  const html = buildAppointmentSheetHtml(base);
  assert.match(html, /^<!doctype html><html lang="es">/);
  assert.match(html, /<title>CMR Bayamon<\/title>/);
});

test("appointment sheet: black-and-white letterhead with the logo, center name, address and phone", () => {
  const html = buildAppointmentSheetHtml(base);
  assert.match(html, /<img class="logo" src="https:\/\/app.example\/img\/logo_cmr_bw.png" alt="">/);
  assert.match(html, /<div class="center-name">CMR Bayamon<\/div>/);
  assert.match(html, /51 Calle Dr. Santiago Veve, Bayamón, 00961/);
  assert.match(html, /787-780-7575/);
  // No colour anywhere: the sheet is printed on a black-and-white printer.
  assert.doesNotMatch(APPOINTMENT_SHEET_CSS, /#0f3d5e/);
});

test("appointment sheet: one block per day with its date tile, long date, time and service", () => {
  const html = buildAppointmentSheetHtml(base);
  assert.equal(html.match(/<li class="day">/g)?.length, 1);
  assert.equal(html.match(/<div class="appt">/g)?.length, 1);
  assert.match(html, /<span class="wd">mié<\/span><span class="dn">9<\/span><span class="mo">dic<\/span>/);
  assert.match(html, /miércoles, 9 de diciembre de 2026/);
  assert.match(html, /<div class="time">11:00<\/div>/);
  assert.match(html, /<div class="service">CONSULTA NUEVA<\/div>/);
});

test("appointment sheet: several appointments on one day share one date tile, each with its time", () => {
  const second = { ...base.rows[0], time: "14:30", service: "TERAPIA PRP" };
  const other = { ...base.rows[0], weekday: "vie", day: "11", dateLong: "viernes, 11 de diciembre de 2026", time: "9:30" };
  const html = buildAppointmentSheetHtml({ ...base, rows: [base.rows[0], second, other] });
  assert.equal(html.match(/<li class="day">/g)?.length, 2);
  assert.equal(html.match(/<div class="appt">/g)?.length, 3);
  assert.equal(html.match(/miércoles, 9 de diciembre de 2026/g)?.length, 1);
  assert.match(html, /<div class="time">11:00<\/div>.*<div class="time">14:30<\/div>.*<div class="time">9:30<\/div>/);
});

test("appointment sheet: doctor and the moved-from line only when there is one (never a blank)", () => {
  assert.doesNotMatch(buildAppointmentSheetHtml(base), /class="doctor"|class="moved"/);
  const html = buildAppointmentSheetHtml({
    ...base,
    rows: [{ ...base.rows[0], doctor: "Dra. López", movedFrom: "Antes: mar, 24 nov · 9:00" }],
  });
  assert.match(html, /<div class="doctor">Dra. López<\/div>/);
  assert.match(html, /<div class="moved">Antes: mar, 24 nov · 9:00<\/div>/);
});

test("appointment sheet: missing address, phone, record and call-us line are omitted", () => {
  const html = buildAppointmentSheetHtml({ ...base, center: { name: "CMR" }, record: null, callUs: null });
  assert.doesNotMatch(html, /class="center-line"/);
  assert.doesNotMatch(html, /class="record"/);
  assert.doesNotMatch(html, /class="call-us"/);
});

test("appointment sheet: everything from data is escaped", () => {
  const html = buildAppointmentSheetHtml({ ...base, patientName: "<b>x</b>", rows: [{ ...base.rows[0], service: "A & B" }] });
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /A &amp; B/);
});

test("appointment sheet: zero page margin hides the browser's date/URL header; rows never split", () => {
  assert.match(APPOINTMENT_SHEET_CSS, /@page\{size:letter;margin:0\}/);
  assert.match(APPOINTMENT_SHEET_CSS, /li\.day\{[^}]*break-inside:avoid/);
});
